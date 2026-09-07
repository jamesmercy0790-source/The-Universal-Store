import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getCjOrderDetail } from "@/lib/suppliers/cj/client";
import { mapCjOrderStatus } from "@/lib/suppliers/cj/status-mapping";
import { logActivity } from "@/lib/services/activity";
import { sendEmail } from "@/lib/email/service";
import { orderShippedEmail, orderDeliveredEmail } from "@/lib/email/templates";

/**
 * Fallback for orders not yet delivered: polls CJ's order-detail endpoint
 * (status + tracking in one call) and reconciles it against this store's
 * shipment/order state. The fast path would be a CJ webhook where one is
 * supported — this is the safety net for anything a webhook misses, and
 * today the only path at all since no CJ webhook is wired up yet.
 *
 * Every CJ status is run through the explicit mapping layer
 * (lib/suppliers/cj/status-mapping.ts) — an unrecognized status is
 * flagged for admin review, never guessed at.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: log } = await supabase
    .from("supplier_sync_logs")
    .insert({ sync_type: "tracking", status: "running" })
    .select("id")
    .single();

  const { data: openOrders } = await supabase
    .from("orders")
    .select("id, order_number, email, shipping_status")
    .in("shipping_status", ["pending", "shipped", "in_transit", "out_for_delivery"]);

  const orderById = new Map((openOrders ?? []).map((o) => [o.id, o]));
  const orderIds = [...orderById.keys()];
  const { data: supplierOrders } = await supabase
    .from("supplier_orders")
    .select("id, order_id, supplier_order_id, cj_order_status, cj_sub_status")
    .in("order_id", orderIds.length > 0 ? orderIds : ["00000000-0000-0000-0000-000000000000"])
    .not("supplier_order_id", "is", null);

  let processed = 0;
  let failed = 0;

  for (const so of supplierOrders ?? []) {
    try {
      const parentOrder = orderById.get(so.order_id);
      const detail = await getCjOrderDetail(so.supplier_order_id!);
      const mapped = mapCjOrderStatus(detail.orderStatus, detail.subStatus);

      if (mapped.needsAdminReview) {
        await supabase.from("admin_notifications").insert({
          type: "cj_status_needs_review",
          title: `Unrecognized CJ status while polling tracking`,
          body: `Order (supplier_orders.id=${so.id}) returned CJ status "${detail.orderStatus}"/"${detail.subStatus ?? ""}" — not in the known mapping.`
        });
        continue; // don't touch order/shipment state on an unrecognized status
      }

      // The real change signal is the CJ status itself, not the tracking
      // number — a shipment typically keeps the same tracking number
      // across several status changes (shipped -> in_transit ->
      // delivered), so gating on tracking-number-changed alone would
      // silently stop recording events after the first one.
      const statusChanged =
        detail.orderStatus !== so.cj_order_status || (detail.subStatus ?? null) !== so.cj_sub_status;

      if (!statusChanged) {
        processed += 1;
        continue;
      }

      await supabase
        .from("supplier_orders")
        .update({ cj_order_status: detail.orderStatus, cj_sub_status: detail.subStatus ?? null })
        .eq("id", so.id);

      const orderUpdate: Record<string, string> = {};
      if (mapped.fulfillmentStatus) orderUpdate.fulfillment_status = mapped.fulfillmentStatus;
      if (mapped.shippingStatus) orderUpdate.shipping_status = mapped.shippingStatus;
      if (Object.keys(orderUpdate).length > 0) {
        await supabase.from("orders").update(orderUpdate).eq("id", so.order_id);
      }

      // find-or-create the shipment for this order (submitOrderToCj
      // creates one at submission time, but this stays defensive in
      // case that step is ever skipped for an older order).
      let { data: shipment } = await supabase
        .from("shipments")
        .select("id, tracking_number")
        .eq("order_id", so.order_id)
        .maybeSingle();

      if (!shipment) {
        const { data: created } = await supabase
          .from("shipments")
          .insert({ order_id: so.order_id, status: mapped.shippingStatus ?? "pending" })
          .select("id, tracking_number")
          .single();
        shipment = created;
      }

      if (shipment) {
        await supabase
          .from("shipments")
          .update({
            tracking_number: detail.trackNumber ?? shipment.tracking_number,
            carrier: detail.trackingProvider ?? undefined,
            tracking_url: detail.trackingUrl ?? undefined,
            status: mapped.shippingStatus ?? "pending"
          })
          .eq("id", shipment.id);

        await supabase.from("tracking_events").insert({
          shipment_id: shipment.id,
          status: detail.orderStatus,
          description: detail.subStatus ?? null,
          occurred_at: new Date().toISOString(),
          raw_source: detail
        });
      }

      // Customer email on a genuine shipped/delivered transition only —
      // best-effort, never lets an email failure break the sync itself.
      if (parentOrder?.email && mapped.shippingStatus && mapped.shippingStatus !== parentOrder.shipping_status) {
        try {
          if (mapped.shippingStatus === "shipped") {
            await sendEmail({
              to: parentOrder.email,
              ...orderShippedEmail({
                orderNumber: parentOrder.order_number,
                trackingNumber: detail.trackNumber,
                trackingUrl: detail.trackingUrl
              })
            });
          } else if (mapped.shippingStatus === "delivered") {
            await sendEmail({
              to: parentOrder.email,
              ...orderDeliveredEmail({ orderNumber: parentOrder.order_number })
            });
          }
        } catch (err) {
          await logActivity({
            actorType: "system",
            eventType: "email.send_failed",
            metadata: { context: "tracking_update", error: err instanceof Error ? err.message : String(err) }
          });
        }
      }

      processed += 1;
    } catch (err) {
      failed += 1;
      await logActivity({
        actorType: "system",
        eventType: "tracking.poll_failed",
        entityType: "supplier_order",
        entityId: so.id,
        metadata: { error: err instanceof Error ? err.message : String(err) }
      });
    }
  }

  await supabase
    .from("supplier_sync_logs")
    .update({
      status: failed > 0 && processed === 0 ? "failed" : "success",
      items_processed: processed,
      error_message: failed > 0 ? `${failed} supplier order(s) failed to sync` : null,
      finished_at: new Date().toISOString()
    })
    .eq("id", log!.id);

  return NextResponse.json({ processed, failed });
}
