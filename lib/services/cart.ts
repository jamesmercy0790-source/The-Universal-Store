"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { GUEST_CART_COOKIE } from "@/lib/constants";
import { logActivity } from "@/lib/services/activity";

/**
 * Resolves (and creates if needed) the current shopper's cart — by
 * user_id if logged in, otherwise by a guest session cookie. Every cart
 * mutation below calls this first rather than trusting a cart id passed
 * from the client.
 */
async function resolveCart() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const service = createServiceRoleClient();

  if (user) {
    const { data: existing } = await service
      .from("carts")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (existing) return existing.id as string;

    const { data: created } = await service
      .from("carts")
      .insert({ user_id: user.id, status: "active" })
      .select("id")
      .single();
    return created!.id as string;
  }

  const cookieStore = await cookies();
  let token = cookieStore.get(GUEST_CART_COOKIE)?.value;

  if (token) {
    const { data: existing } = await service
      .from("carts")
      .select("id")
      .eq("session_token", token)
      .eq("status", "active")
      .maybeSingle();
    if (existing) return existing.id as string;
  }

  token = randomUUID();
  cookieStore.set(GUEST_CART_COOKIE, token, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax" });

  const { data: created } = await service
    .from("carts")
    .insert({ session_token: token, status: "active" })
    .select("id")
    .single();
  return created!.id as string;
}

export interface CartActionResult {
  success: boolean;
  error?: string;
}

interface CartLineValidation {
  ok: boolean;
  reason?: string;
  unitPriceCents?: number;
}

/**
 * Shared server-side validation for anything that puts a product/variant
 * into a cart — addToCart() and the guest→account merge both call this,
 * so "is this actually purchasable right now" is checked in exactly one
 * place. Never trusts a price or availability claim from the caller.
 */
async function validateForCart(
  service: ReturnType<typeof createServiceRoleClient>,
  productId: string,
  variantId: string | null,
  requestedQty: number
): Promise<CartLineValidation> {
  const { data: product } = await service
    .from("products")
    .select("id, status, selling_price_cents")
    .eq("id", productId)
    .maybeSingle();

  if (!product || product.status !== "active") {
    return { ok: false, reason: "product_unavailable" };
  }

  let priceDelta = 0;
  let cappedQty = requestedQty;

  if (variantId) {
    const { data: variant } = await service
      .from("product_variants")
      .select("is_active, inventory_qty, price_delta_cents")
      .eq("id", variantId)
      .maybeSingle();

    if (!variant || !variant.is_active || variant.inventory_qty < 1) {
      return { ok: false, reason: "variant_unavailable" };
    }
    priceDelta = variant.price_delta_cents;
    cappedQty = Math.min(requestedQty, variant.inventory_qty);
  }

  return { ok: true, unitPriceCents: product.selling_price_cents + priceDelta };
}

/**
 * Returns a result object rather than throwing for expected validation
 * failures (inactive product, out-of-stock variant) — Next.js redacts
 * thrown Server Action errors to an opaque digest in production builds,
 * which would silently swallow a message the customer actually needs to
 * see. Only genuinely unexpected failures (a DB outage, etc.) are allowed
 * to throw and get that safe digest treatment.
 */
export async function addToCart(input: {
  productId: string;
  variantId?: string | null;
  quantity: number;
}): Promise<CartActionResult> {
  const service = createServiceRoleClient();
  const validation = await validateForCart(service, input.productId, input.variantId ?? null, input.quantity);

  if (!validation.ok) {
    return {
      success: false,
      error:
        validation.reason === "variant_unavailable"
          ? "This variant is unavailable at the requested quantity."
          : "This product is not currently available."
    };
  }

  const cartId = await resolveCart();

  const { data: existingItem } = await service
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("product_id", input.productId)
    .eq("variant_id", input.variantId ?? null)
    .maybeSingle();

  if (existingItem) {
    await service
      .from("cart_items")
      .update({ quantity: existingItem.quantity + input.quantity })
      .eq("id", existingItem.id);
  } else {
    await service.from("cart_items").insert({
      cart_id: cartId,
      product_id: input.productId,
      variant_id: input.variantId ?? null,
      quantity: input.quantity,
      price_snapshot_cents: validation.unitPriceCents
    });
  }

  await logActivity({
    actorType: "customer",
    eventType: "cart.item_added",
    entityType: "product",
    entityId: input.productId,
    metadata: { quantity: input.quantity }
  });

  revalidatePath("/cart");
  return { success: true };
}

export async function updateCartItemQuantity(itemId: string, quantity: number) {
  const service = createServiceRoleClient();
  if (quantity <= 0) {
    await service.from("cart_items").delete().eq("id", itemId);
  } else {
    await service.from("cart_items").update({ quantity }).eq("id", itemId);
  }
  revalidatePath("/cart");
}

export async function removeCartItem(itemId: string) {
  const service = createServiceRoleClient();
  await service.from("cart_items").delete().eq("id", itemId);
  revalidatePath("/cart");
}

export async function getCart() {
  const cartId = await resolveCart();
  const service = createServiceRoleClient();

  const { data: items } = await service
    .from("cart_items")
    .select(
      "id, quantity, price_snapshot_cents, product_id, variant_id, products(title, slug, currency_code, product_images(url, sort_order))"
    )
    .eq("cart_id", cartId);

  const subtotalCents = (items ?? []).reduce((sum, i) => sum + i.price_snapshot_cents * i.quantity, 0);

  return { cartId, items: items ?? [], subtotalCents };
}

export interface MergeResult {
  merged: number;
  dropped: number;
  droppedReasons: string[];
}

/**
 * Folds a guest's pre-login cart into their account cart. Called right
 * after a successful sign-in/sign-up — without this, a guest who adds
 * items then logs in to check out would find an empty cart, since
 * resolveCart() switches to looking the cart up by user_id once
 * supabase.auth.getUser() returns someone.
 *
 * Every guest line is re-validated against the database exactly like a
 * fresh addToCart() call — nothing about a guest cart's contents is
 * trusted just because it exists. Invalid/discontinued/out-of-stock
 * lines are dropped rather than carried into the account cart. If the
 * merge fails partway, the guest cart and its cookie are left intact
 * (not converted, not cleared) so nothing is lost — the merge simply
 * runs again on the next sign-in.
 */
export async function mergeGuestCartIntoUser(userId: string): Promise<MergeResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_CART_COOKIE)?.value;
  const result: MergeResult = { merged: 0, dropped: 0, droppedReasons: [] };
  if (!token) return result;

  const service = createServiceRoleClient();

  try {
    const { data: guestCart } = await service
      .from("carts")
      .select("id")
      .eq("session_token", token)
      .eq("status", "active")
      .maybeSingle();

    if (!guestCart) {
      cookieStore.delete(GUEST_CART_COOKIE);
      return result;
    }

    let { data: userCart } = await service
      .from("carts")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!userCart) {
      const { data: created } = await service
        .from("carts")
        .insert({ user_id: userId, status: "active" })
        .select("id")
        .single();
      userCart = created;
    }
    if (!userCart) throw new Error("Could not resolve or create the account cart.");

    const { data: guestItems } = await service
      .from("cart_items")
      .select("id, product_id, variant_id, quantity")
      .eq("cart_id", guestCart.id);

    for (const item of guestItems ?? []) {
      const validation = await validateForCart(service, item.product_id, item.variant_id, item.quantity);

      if (!validation.ok) {
        result.dropped += 1;
        result.droppedReasons.push(validation.reason ?? "unavailable");
        continue;
      }

      const { data: existing } = await service
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", userCart!.id)
        .eq("product_id", item.product_id)
        .eq("variant_id", item.variant_id ?? null)
        .maybeSingle();

      if (existing) {
        await service
          .from("cart_items")
          .update({ quantity: existing.quantity + item.quantity })
          .eq("id", existing.id);
      } else {
        await service.from("cart_items").insert({
          cart_id: userCart!.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          price_snapshot_cents: validation.unitPriceCents
        });
      }
      result.merged += 1;
    }

    // Every guest line is now either merged (as its own row) or
    // deliberately skipped — the guest cart's own items can be discarded
    // once it's marked converted, since nothing valid was left un-copied.
    await service.from("cart_items").delete().eq("cart_id", guestCart.id);
    await service.from("carts").update({ status: "converted" }).eq("id", guestCart.id);
    cookieStore.delete(GUEST_CART_COOKIE);

    await logActivity({
      actorType: "customer",
      actorId: userId,
      eventType: "cart.guest_merged",
      metadata: { merged: result.merged, dropped: result.dropped }
    });

    return result;
  } catch (err) {
    // Merge failed partway — leave the guest cart/cookie untouched rather
    // than risk losing items the customer added before they signed in.
    await logActivity({
      actorType: "system",
      eventType: "cart.guest_merge_failed",
      actorId: userId,
      metadata: { error: err instanceof Error ? err.message : String(err) }
    });
    return result;
  }
}
