import { createServiceRoleClient } from "@/lib/supabase/server";
import { cjProvider } from "@/lib/suppliers/cj/client";
import { mapCjOrderStatus } from "@/lib/suppliers/cj/status-mapping";
import { logActivity } from "@/lib/services/activity";
import { sendEmail } from "@/lib/email/service";
import { adminFulfillmentFailureEmail } from "@/lib/email/templates";
import { getContactInfo } from "@/lib/services/settings";
import type { FulfillmentOrderInput } from "@/lib/suppliers/types";

const MAX_RETRY_COUNT = 5;

export interface SubmitOrderResult {
  success: boolean;
  alreadySubmitted?: boolean;
  error?: string;
}

/**
 * Submits a paid order to CJ for fulfillment. Safe to call more than once
 * for the same order — idempotent via a `supplier_orders` row claimed
 * *before* the CJ API call is made, so a retry (cron re-poll, a second
 * webhook delivery landing here, etc.) sees the claim and skips rather
 * than creating a second CJ order.
 *
 * Never marks the order fulfilled on failure — a failed CJ submission
 * leaves `orders.fulfillment_status` untouched and raises an admin
 * notification instead (Section 6: "do not falsely mark the order as
 * fulfilled").
 */
export async function submitOrderToCj(orderId: string): Promise<SubmitOrderResult> {
  const supabase = createServiceRoleClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, email, payment_status, shipping_address_json, country_code")
    .eq("id", orderId)
    .single();

  if (!order) return { success: false, error: "Order not found." };
  if (order.payment_status !== "paid") {
    return { success: false, error: "Order is not paid — refusing to submit to CJ." };
  }

  // Claim (or find) the supplier_orders row before touching CJ at all.
  const { data: existingSupplierOrder } = await supabase
    .from("supplier_orders")
    .select("id, status, retry_count")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existingSupplierOrder && existingSupplierOrder.status !== "failed") {
    // Already submitted (or currently being submitted by a concurrent
    // call) — never submit twice.
    return { success: true, alreadySubmitted: true };
  }

  if (existingSupplierOrder && existingSupplierOrder.retry_count >= MAX_RETRY_COUNT) {
    return { success: false, error: "Max retry count reached — needs manual admin attention." };
  }

  const { data: supplierRow } = await supabase.from("suppliers").select("id").eq("type", "cj").maybeSingle();

  let supplierOrderRowId: string;
  if (existingSupplierOrder) {
    supplierOrderRowId = existingSupplierOrder.id;
    await supabase
      .from("supplier_orders")
      .update({ status: "pending", retry_count: existingSupplierOrder.retry_count + 1 })
      .eq("id", supplierOrderRowId);
  } else {
    const { data: created } = await supabase
      .from("supplier_orders")
      .insert({ order_id: orderId, supplier_id: supplierRow?.id ?? null, status: "pending", retry_count: 0 })
      .select("id")
      .single();
    supplierOrderRowId = created!.id;
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("quantity, variant_id, product_variants(supplier_variant_id)")
    .eq("order_id", orderId);

  const mappedItems = (items ?? [])
    .map((i: any) => ({
      supplierVariantId: i.product_variants?.supplier_variant_id as string | undefined,
      quantity: i.quantity as number
    }))
    .filter((i): i is { supplierVariantId: string; quantity: number } => Boolean(i.supplierVariantId));

  if (mappedItems.length === 0 || mappedItems.length !== (items ?? []).length) {
    const message = "One or more order items have no linked CJ variant — cannot auto-fulfill.";
    await failSubmission(supabase, supplierOrderRowId, order, message);
    return { success: false, error: message };
  }

  const address = order.shipping_address_json as Record<string, string>;
  const input: FulfillmentOrderInput = {
    internalOrderId: order.id,
    orderNumber: order.order_number,
    shippingAddress: {
      fullName: address.fullName ?? "",
      line1: address.line1 ?? "",
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      countryCode: order.country_code,
      phone: address.phone
    },
    items: mappedItems
  };

  try {
    const result = await cjProvider.submitOrder(input);

    await supabase
      .from("supplier_orders")
      .update({
        supplier_order_id: result.supplierOrderId,
        status: "submitted",
        cj_order_status: result.status,
        submitted_at: new Date().toISOString(),
        last_error: null
      })
      .eq("id", supplierOrderRowId);

    // A shipments row is what poll-tracking updates and what the customer's
    // order page reads — create it now rather than leaving tracking sync
    // with nothing to attach events to. find-or-create since a retried
    // submission (after a transient failure) must not create a duplicate.
    const { data: existingShipment } = await supabase
      .from("shipments")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!existingShipment) {
      await supabase.from("shipments").insert({ order_id: orderId, status: "pending" });
    }

    const mapped = mapCjOrderStatus(result.status);
    const orderUpdate: Record<string, string> = {};
    if (mapped.fulfillmentStatus) orderUpdate.fulfillment_status = mapped.fulfillmentStatus;
    if (mapped.shippingStatus) orderUpdate.shipping_status = mapped.shippingStatus;
    if (Object.keys(orderUpdate).length > 0) {
      await supabase.from("orders").update(orderUpdate).eq("id", orderId);
    }

    await logActivity({
      actorType: "system",
      eventType: "order.submitted_to_cj",
      entityType: "order",
      entityId: orderId,
      metadata: { order_number: order.order_number, cj_order_id: result.supplierOrderId }
    });

    if (mapped.needsAdminReview) {
      await supabase.from("admin_notifications").insert({
        type: "cj_status_needs_review",
        title: `Unrecognized CJ status on ${order.order_number}`,
        body: `CJ returned status "${result.status}" which isn't in the known mapping — please check manually.`
      });
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failSubmission(supabase, supplierOrderRowId, order, message);
    return { success: false, error: message };
  }
}

async function failSubmission(
  supabase: ReturnType<typeof createServiceRoleClient>,
  supplierOrderRowId: string,
  order: { id: string; order_number: string },
  message: string
) {
  await supabase.from("supplier_orders").update({ status: "failed", last_error: message }).eq("id", supplierOrderRowId);

  await logActivity({
    actorType: "system",
    eventType: "cj.order_submission_failed",
    entityType: "order",
    entityId: order.id,
    metadata: { order_number: order.order_number, error: message }
  });

  await supabase.from("admin_notifications").insert({
    type: "cj_order_submission_failed",
    title: `CJ fulfillment failed — ${order.order_number}`,
    body: message
  });

  try {
    const { email } = await getContactInfo();
    if (email) {
      await sendEmail({
        to: email,
        ...adminFulfillmentFailureEmail({ orderNumber: order.order_number, error: message })
      });
    }
  } catch {
    // Email is best-effort here too — the admin_notifications row above
    // is the durable record regardless of whether this send succeeds.
  }
}
