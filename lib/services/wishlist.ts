"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/services/activity";
import { addToCart } from "@/lib/services/cart";

/**
 * Wishlist is account-only by design (Section 9: "do not store the
 * permanent wishlist only in localStorage"). All actions below return a
 * result object rather than throwing for expected outcomes (not signed
 * in, item missing) — Next.js redacts thrown Server Action errors to an
 * opaque digest in production, which would swallow a message the
 * customer actually needs to see.
 */
export interface WishlistActionResult {
  success: boolean;
  error?: string;
  requiresAuth?: boolean;
}

export async function addToWishlist(
  productId: string,
  variantId?: string | null
): Promise<WishlistActionResult> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, requiresAuth: true, error: "Sign in to save items to your wishlist." };
  }

  const service = createServiceRoleClient();
  await service
    .from("wishlist_items")
    .upsert(
      { user_id: user.id, product_id: productId, variant_id: variantId ?? null },
      { onConflict: "user_id,product_id,variant_id" }
    );

  await logActivity({
    actorType: "customer",
    actorId: user.id,
    eventType: "wishlist.item_added",
    entityType: "product",
    entityId: productId
  });

  revalidatePath("/wishlist");
  return { success: true };
}

export async function removeFromWishlist(wishlistItemId: string): Promise<WishlistActionResult> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { success: false, requiresAuth: true, error: "Sign in required." };

  const service = createServiceRoleClient();
  await service.from("wishlist_items").delete().eq("id", wishlistItemId).eq("user_id", user.id);

  await logActivity({
    actorType: "customer",
    actorId: user.id,
    eventType: "wishlist.item_removed",
    entityType: "wishlist_item",
    entityId: wishlistItemId
  });

  revalidatePath("/wishlist");
  return { success: true };
}

export async function moveWishlistItemToCart(wishlistItemId: string): Promise<WishlistActionResult> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { success: false, requiresAuth: true, error: "Sign in required." };

  const service = createServiceRoleClient();
  const { data: item } = await service
    .from("wishlist_items")
    .select("id, product_id, variant_id")
    .eq("id", wishlistItemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!item) return { success: false, error: "Wishlist item not found." };

  const cartResult = await addToCart({ productId: item.product_id, variantId: item.variant_id, quantity: 1 });
  if (!cartResult.success) return cartResult;

  await service.from("wishlist_items").delete().eq("id", wishlistItemId);

  revalidatePath("/wishlist");
  revalidatePath("/cart");
  return { success: true };
}

export async function getWishlist() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { signedIn: false as const, items: [] };

  const service = createServiceRoleClient();
  const { data: items } = await service
    .from("wishlist_items")
    .select(
      "id, product_id, variant_id, added_at, products(title, slug, selling_price_cents, currency_code, status, product_images(url, sort_order))"
    )
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  return { signedIn: true as const, items: items ?? [] };
}
