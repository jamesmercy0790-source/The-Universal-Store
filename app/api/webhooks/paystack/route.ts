import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { paystackProvider } from "@/lib/payments/paystack/client";
import { markOrderPaidFromWebhook } from "@/lib/services/orders";

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!paystackProvider.verifyWebhookSignature(rawBody, request.headers)) {
    // Never process an unverified webhook, and never leak *why* it failed
    // beyond a generic 401 — signature details aren't diagnostic info for
    // whoever is calling this endpoint.
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const eventId = `${event.event}:${event.data?.reference}`;

  const supabase = createServiceRoleClient();

  // Idempotency guard — a webhook may be redelivered by the provider.
  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("source", "paystack")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await supabase.from("webhook_events").insert({
    source: "paystack",
    event_id: eventId,
    payload_json: event,
    status: "received"
  });

  // Reconcile whenever the event carries a transaction reference,
  // regardless of what this particular event claims happened — the
  // reconciliation function re-verifies the real status directly against
  // Paystack's API rather than trusting the payload, so this covers
  // success, failure, and anything else in one path.
  if (event.data?.reference) {
    await markOrderPaidFromWebhook({
      provider: "paystack",
      providerReference: event.data.reference
    });
  }

  await supabase
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString(), status: "processed" })
    .eq("source", "paystack")
    .eq("event_id", eventId);

  return NextResponse.json({ received: true });
}
