import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { flutterwaveProvider } from "@/lib/payments/flutterwave/client";
import { markOrderPaidFromWebhook } from "@/lib/services/orders";

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!flutterwaveProvider.verifyWebhookSignature(rawBody, request.headers)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const eventId = `${event.event ?? "charge"}:${event.data?.tx_ref}`;

  const supabase = createServiceRoleClient();

  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("source", "flutterwave")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await supabase.from("webhook_events").insert({
    source: "flutterwave",
    event_id: eventId,
    payload_json: event,
    status: "received"
  });

  // Reconcile whenever the event carries a transaction reference,
  // regardless of what this particular event claims happened — the
  // reconciliation function re-verifies the real status directly against
  // Flutterwave's API rather than trusting the payload, so this covers
  // success, failure, and anything else in one path.
  if (event.data?.tx_ref) {
    await markOrderPaidFromWebhook({
      provider: "flutterwave",
      providerReference: event.data.tx_ref
    });
  }

  await supabase
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString(), status: "processed" })
    .eq("source", "flutterwave")
    .eq("event_id", eventId);

  return NextResponse.json({ received: true });
}
