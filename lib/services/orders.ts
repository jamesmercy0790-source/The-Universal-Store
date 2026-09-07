import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getProviderById } from "@/lib/payments/router";
import { logActivity } from "@/lib/services/activity";
import { submitOrderToCj } from "@/lib/services/fulfillment";
import { sendEmail } from "@/lib/email/service";
import { orderConfirmedEmail, paymentFailedEmail } from "@/lib/email/templates";
import type { PaymentProvider } from "@/lib/payments/types";

/**
 * Email is always best-effort — a missing RESEND_API_KEY or a Resend
 * outage must never break payment confirmation, fulfillment, or any
 * other real business operation. Every call site wraps this, never the
 * bare sendEmail() import.
 */
async function sendTransactional(to: string, template: { subject: string; html: string }, context: string) {
  try {
    await sendEmail({ to, subject: template.subject, html: template.html });
  } catch (err) {
    await logActivity({
      actorType: "system",
      eventType: "email.send_failed",
      metadata: { context, error: err instanceof Error ? err.message : String(err) }
    });
  }
}

/**
 * The single entry point for reconciling an order/payment against what
 * the provider actually confirms. Called from webhook handlers only —
 * never from a client-facing "payment successful" redirect page, since a
 * browser redirect can be spoofed or interrupted. Always re-verifies
 * against the provider's API directly (not the webhook payload) before
 * touching order state, and is safe to call repeatedly for the same
 * reference: once an order reaches a terminal payment state (paid,
 * failed, refunded) this is a no-op, which is what makes duplicate
 * webhook deliveries and duplicate payment callbacks harmless.
 */
export async function markOrderPaidFromWebhook(params: {
  provider: PaymentProvider["id"];
  providerReference: string;
}) {
  const supabase = createServiceRoleClient();
  const provider = getProviderById(params.provider);
  const verification = await provider.verifyPayment(params.providerReference);

  const { data: payment } = await supabase
    .from("payments")
    .select("id, order_id, amount_cents, currency_code")
    .eq("provider", params.provider)
    .eq("provider_reference", params.providerReference)
    .maybeSingle();

  // The payment row is created by the checkout Server Action when the
  // session is initiated — the webhook confirms it, it doesn't invent it.
  if (!payment) {
    await logActivity({
      actorType: "system",
      eventType: "payment.webhook_unmatched",
      metadata: { provider: params.provider, reference: params.providerReference }
    });
    return;
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, payment_status, email")
    .eq("id", payment.order_id)
    .single();

  if (!order) return;

  if (["paid", "failed", "refunded"].includes(order.payment_status)) {
    // Already in a terminal state — a redelivered webhook or a repeated
    // browser callback lands here and does nothing further.
    return;
  }

  if (verification.status === "failed") {
    await supabase
      .from("payments")
      .update({ status: "failed", raw_event_json: verification.raw })
      .eq("id", payment.id);
    await supabase.from("orders").update({ payment_status: "failed" }).eq("id", order.id);

    await logActivity({
      actorType: "system",
      eventType: "payment.failed",
      entityType: "order",
      entityId: order.id,
      metadata: { order_number: order.order_number, provider: params.provider }
    });
    await supabase.from("admin_notifications").insert({
      type: "failed_payment",
      title: `Payment failed — ${order.order_number}`,
      body: `Payment via ${params.provider} did not succeed.`
    });
    if (order.email) {
      await sendTransactional(order.email, paymentFailedEmail({ orderNumber: order.order_number }), "payment_failed");
    }
    return;
  }

  if (verification.status === "pending") {
    // Still processing on the provider's side (or abandoned mid-flow) —
    // leave the order pending rather than guessing either way.
    await logActivity({
      actorType: "system",
      eventType: "payment.verification_pending",
      entityType: "order",
      entityId: order.id,
      metadata: { provider: params.provider, reference: params.providerReference }
    });
    return;
  }

  // Server-side validation of the final payment currency and amount
  // (hard constraint #1) — the provider's verified response is the source
  // of truth for what was actually charged, but a mismatch against what
  // we expected to charge is still worth surfacing rather than silently
  // trusting either number. The order is still marked paid on a
  // mismatch — refusing to fulfill money that was genuinely received
  // would be worse than flagging it — but an admin gets an explicit
  // notification to reconcile manually.
  const amountMismatch =
    Math.abs(verification.amountCents - payment.amount_cents) > Math.max(50, payment.amount_cents * 0.01);
  const currencyMismatch = verification.currency !== payment.currency_code;

  if (amountMismatch || currencyMismatch) {
    await logActivity({
      actorType: "system",
      eventType: "payment.amount_currency_mismatch",
      entityType: "order",
      entityId: order.id,
      metadata: {
        expected_amount_cents: payment.amount_cents,
        expected_currency: payment.currency_code,
        verified_amount_cents: verification.amountCents,
        verified_currency: verification.currency,
        provider: params.provider
      }
    });
    await supabase.from("admin_notifications").insert({
      type: "payment_mismatch",
      title: `Payment amount/currency mismatch on ${order.order_number}`,
      body: `Expected ${payment.amount_cents} ${payment.currency_code}, provider confirmed ${verification.amountCents} ${verification.currency}. Needs manual review.`
    });
  }

  await supabase
    .from("payments")
    .update({
      status: "paid",
      amount_cents: verification.amountCents,
      currency_code: verification.currency,
      raw_event_json: verification.raw
    })
    .eq("id", payment.id);

  await supabase.from("orders").update({ payment_status: "paid" }).eq("id", order.id);

  await logActivity({
    actorType: "system",
    eventType: "order.paid",
    entityType: "order",
    entityId: order.id,
    metadata: { order_number: order.order_number, provider: params.provider }
  });

  await supabase.from("admin_notifications").insert({
    type: "new_payment",
    title: `Payment received — ${order.order_number}`,
    body: `${(verification.amountCents / 100).toFixed(2)} ${verification.currency} via ${params.provider}.`
  });

  if (order.email) {
    const { data: items } = await supabase.from("order_items").select("title_snapshot").eq("order_id", order.id);
    const { data: fullOrder } = await supabase.from("orders").select("total_cents, currency_code, exchange_rate_snapshot").eq("id", order.id).single();
    if (fullOrder) {
      const { convertUsdCents } = await import("@/lib/currency/service");
      await sendTransactional(
        order.email,
        orderConfirmedEmail({
          orderNumber: order.order_number,
          totalCents: convertUsdCents(fullOrder.total_cents, fullOrder.exchange_rate_snapshot),
          currency: fullOrder.currency_code,
          itemTitles: (items ?? []).map((i) => i.title_snapshot)
        }),
        "order_confirmed"
      );
    }
  }

  // Automatic CJ fulfillment. Awaited (not fire-and-forget) since
  // serverless functions aren't guaranteed to keep running background
  // work after the response is sent — submitOrderToCj() is idempotent
  // and handles its own errors internally (never throws), so this can't
  // take down the payment confirmation itself; a failure here just means
  // the order stays unfulfilled with an admin notification already
  // raised, and the retry cron (see app/api/cron/retry-fulfillment)
  // picks it up on the next run.
  await submitOrderToCj(order.id);
}

/**
 * Reads an order for display to its own customer — uses the RLS-scoped
 * client (not the service role) so a mismatched or guessed order number
 * simply returns nothing rather than needing a manual ownership check
 * here. Admin access to any order goes through the admin dashboard's own
 * requireAdmin()-gated queries, not this function.
 */
export async function getOrderForCustomer(orderNumber: string) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, payment_status, fulfillment_status, shipping_status, currency_code, country_code, subtotal_cents, shipping_cents, tax_cents, total_cents, exchange_rate_snapshot, shipping_address_json, created_at, order_items(id, title_snapshot, sku_snapshot, quantity, unit_price_cents), shipments(id, carrier, tracking_number, tracking_url, status, tracking_events(id, status, description, occurred_at))"
    )
    .eq("order_number", orderNumber)
    .maybeSingle();

  return order;
}

/** All orders for the current customer, newest first — powers /account/orders. */
export async function listOrdersForCustomer() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, payment_status, fulfillment_status, shipping_status, currency_code, total_cents, exchange_rate_snapshot, created_at, order_items(id)"
    )
    .order("created_at", { ascending: false });

  return orders ?? [];
}
