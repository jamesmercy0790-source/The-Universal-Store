"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getCart } from "@/lib/services/cart";
import { getShopperLocale } from "@/lib/services/geo";
import { validateCheckoutLines, type ValidatedLine } from "@/lib/services/pricing";
import { getTaxRatePercent, calculateTaxCents } from "@/lib/services/tax";
import { getCurrentRate, convertUsdCents } from "@/lib/currency/service";
import { selectPaymentProvider, UnsupportedPaymentRouteError } from "@/lib/payments/router";
import type { SupportedCurrency } from "@/lib/payments/types";
import { logActivity } from "@/lib/services/activity";
import { validateCoupon, incrementCouponUsage } from "@/lib/services/coupons";

export interface CheckoutSummaryLine extends ValidatedLine {
  lineTotalUsdCents: number;
}

export interface CheckoutSummary {
  lines: CheckoutSummaryLine[];
  subtotalUsdCents: number;
  shippingUsdCents: number;
  taxUsdCents: number;
  discountUsdCents: number;
  couponId: string | null;
  couponCode: string | null;
  couponError: string | null;
  totalUsdCents: number;
  countryCode: string;
  currencyCode: string;
  exchangeRate: number;
  totalDisplayCents: number;
}

export type CheckoutResult = { success: true; summary: CheckoutSummary } | { success: false; error: string };

/**
 * Re-derives the full checkout total from the database every time it's
 * called — cart price snapshots are a display convenience only. This is
 * the same function called both to render the checkout page and, again,
 * at order submission — nothing about the total is ever trusted from an
 * earlier read or from the client (hard constraint #1 / Section 20/56).
 *
 * `couponCode` is optional and re-validated server-side every time too —
 * a coupon can only ever discount a total this function itself computed,
 * never a client-submitted one (Section 12: "never trust coupon
 * calculations from the browser").
 */
export async function getCheckoutSummary(couponCode?: string | null): Promise<CheckoutResult> {
  const { countryCode, currencyCode } = await getShopperLocale();
  if (!countryCode || !currencyCode) {
    return { success: false, error: "Select your shopping country before checking out." };
  }

  const { items } = await getCart();
  if (items.length === 0) {
    return { success: false, error: "Your cart is empty." };
  }

  let validated: Awaited<ReturnType<typeof validateCheckoutLines>>;
  try {
    validated = await validateCheckoutLines(
      items.map((i: any) => ({ productId: i.product_id, variantId: i.variant_id, quantity: i.quantity })),
      countryCode
    );
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Checkout validation failed." };
  }

  const lines: CheckoutSummaryLine[] = validated.lines.map((l) => ({
    ...l,
    lineTotalUsdCents: l.unitPriceUsdCents * l.quantity
  }));

  const subtotalUsdCents = lines.reduce((sum, l) => sum + l.lineTotalUsdCents, 0);
  const shippingUsdCents = validated.shippingCents;

  let discountUsdCents = 0;
  let couponId: string | null = null;
  let couponError: string | null = null;
  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, subtotalUsdCents);
    if (couponResult.valid) {
      discountUsdCents = couponResult.discountCents!;
      couponId = couponResult.couponId!;
    } else {
      couponError = couponResult.error ?? "Invalid coupon.";
    }
  }

  const discountedSubtotal = subtotalUsdCents - discountUsdCents;
  const taxRatePercent = await getTaxRatePercent(countryCode);
  const taxUsdCents = calculateTaxCents(discountedSubtotal + shippingUsdCents, taxRatePercent);
  const totalUsdCents = discountedSubtotal + shippingUsdCents + taxUsdCents;

  let exchangeRate: number;
  try {
    exchangeRate = await getCurrentRate(currencyCode);
  } catch {
    return {
      success: false,
      error: `Pricing for ${currencyCode} isn't available right now — please try again shortly.`
    };
  }

  return {
    success: true,
    summary: {
      lines,
      subtotalUsdCents,
      shippingUsdCents,
      taxUsdCents,
      discountUsdCents,
      couponId,
      couponCode: couponId ? (couponCode ?? null) : null,
      couponError,
      totalUsdCents,
      countryCode,
      currencyCode,
      exchangeRate,
      totalDisplayCents: convertUsdCents(totalUsdCents, exchangeRate)
    }
  };
}

function generateOrderNumber(): string {
  return `TUS-${randomInt(100000, 999999)}`;
}

export interface ShippingAddressInput {
  fullName: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
}

/**
 * The single entry point that turns a validated cart into a real order
 * and a live payment session. Every price/availability input is
 * re-derived from the database at call time via getCheckoutSummary() —
 * the shipping address is the only thing taken from the form, and even
 * that doesn't affect price, currency, or provider selection.
 *
 * `idempotencyKey` is generated once client-side per checkout page load
 * (see CheckoutForm) and stays the same across retries from that same
 * load — a double-click, a slow-network retry, or a refresh-and-resubmit
 * all carry the same key. If an order already exists for this key, this
 * function sends the customer back to that existing order's status page
 * instead of creating a second order or a second charge.
 */
export async function placeOrder(
  address: ShippingAddressInput,
  idempotencyKey: string,
  couponCode?: string | null
): Promise<{ success: false; error: string } | void> {
  const user = await requireUser();
  const service = createServiceRoleClient();

  const { data: existingOrder } = await service
    .from("orders")
    .select("order_number")
    .eq("idempotency_key", idempotencyKey)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingOrder) {
    // This exact checkout attempt already produced an order — never start
    // a second payment session for it. Send the customer to that order's
    // status instead (hard constraint #6: prevent duplicate orders from
    // a retried/double-submitted request).
    redirect(`/checkout/return?order=${existingOrder.order_number}`);
  }

  const summaryResult = await getCheckoutSummary(couponCode);
  if (!summaryResult.success) {
    return { success: false, error: summaryResult.error };
  }
  const summary = summaryResult.summary;

  await logActivity({
    actorType: "customer",
    actorId: user.id,
    eventType: "checkout.started",
    metadata: {
      country: summary.countryCode,
      currency: summary.currencyCode,
      total_usd_cents: summary.totalUsdCents,
      coupon_id: summary.couponId
    }
  });

  let provider;
  try {
    provider = selectPaymentProvider(summary.countryCode, summary.currencyCode as SupportedCurrency);
  } catch (err) {
    if (err instanceof UnsupportedPaymentRouteError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "No payment method is currently available for your country." };
  }

  const orderNumber = generateOrderNumber();

  const { data: order, error: orderError } = await service
    .from("orders")
    .insert({
      order_number: orderNumber,
      idempotency_key: idempotencyKey,
      user_id: user.id,
      email: user.email,
      phone: address.phone ?? null,
      currency_code: summary.currencyCode,
      country_code: summary.countryCode,
      subtotal_cents: summary.subtotalUsdCents,
      shipping_cents: summary.shippingUsdCents,
      tax_cents: summary.taxUsdCents,
      discount_cents: summary.discountUsdCents,
      coupon_id: summary.couponId,
      total_cents: summary.totalUsdCents,
      exchange_rate_snapshot: summary.exchangeRate,
      payment_status: "pending",
      fulfillment_status: "unfulfilled",
      shipping_status: "pending",
      shipping_address_json: address
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    // A unique-constraint conflict on idempotency_key here means a
    // concurrent request for this exact same checkout attempt won the
    // race — fetch what it created rather than erroring out or, worse,
    // creating a duplicate.
    const { data: raceWinner } = await service
      .from("orders")
      .select("order_number")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (raceWinner) {
      redirect(`/checkout/return?order=${raceWinner.order_number}`);
    }
    return { success: false, error: "Couldn't create your order. Please try again." };
  }

  await service.from("order_items").insert(
    summary.lines.map((l) => ({
      order_id: order.id,
      product_id: l.productId,
      variant_id: l.variantId,
      title_snapshot: l.titleSnapshot,
      sku_snapshot: l.skuSnapshot,
      quantity: l.quantity,
      unit_price_cents: l.unitPriceUsdCents,
      supplier_cost_cents: l.supplierCostCents,
      supplier_shipping_cost_cents: l.supplierShippingCostCents,
      margin_percent_used: l.marginPercentUsed,
      gross_profit_cents: l.grossProfitCents
    }))
  );

  if (summary.couponId) {
    // Counted now, against a real created order — never speculatively at
    // validation time, so an abandoned checkout never consumes a use.
    await incrementCouponUsage(summary.couponId);
  }

  await logActivity({
    actorType: "customer",
    actorId: user.id,
    eventType: "order.created",
    entityType: "order",
    entityId: order.id,
    metadata: { order_number: order.order_number, country: summary.countryCode }
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let session;
  try {
    session = await provider.createPaymentSession({
      orderId: order.id,
      orderNumber: order.order_number,
      amountCents: summary.totalDisplayCents,
      currency: summary.currencyCode as SupportedCurrency,
      customerEmail: user.email!,
      countryCode: summary.countryCode,
      callbackUrl: `${siteUrl}/checkout/return?order=${order.order_number}`,
      metadata: { order_id: order.id }
    });
  } catch (err) {
    await logActivity({
      actorType: "system",
      eventType: "payment.session_creation_failed",
      entityType: "order",
      entityId: order.id,
      metadata: { provider: provider.id, error: err instanceof Error ? err.message : String(err) }
    });
    return {
      success: false,
      error: "We couldn't start payment for this order. Please try again — your order was saved as pending."
    };
  }

  await service.from("payments").insert({
    order_id: order.id,
    provider: provider.id,
    provider_reference: session.providerReference,
    status: "pending",
    amount_cents: summary.totalDisplayCents,
    currency_code: summary.currencyCode
  });

  redirect(session.authorizationUrl);
}
