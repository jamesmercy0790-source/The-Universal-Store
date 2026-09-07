import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { submitOrderToCj } from "@/lib/services/fulfillment";

/**
 * Safety net for automatic fulfillment (Section 6): catches orders that
 * are paid but never got submitted to CJ — either because the inline
 * attempt in markOrderPaidFromWebhook() failed, or the webhook handler
 * itself never completed that step. submitOrderToCj() is idempotent, so
 * running this against an already-submitted order is a harmless no-op.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  // Case 1: paid orders with no supplier_orders row at all, or one stuck
  // at "pending" (claimed but never completed — e.g. the function was
  // killed mid-call) or "failed" under the retry cap.
  const { data: paidOrders } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("payment_status", "paid")
    .eq("fulfillment_status", "unfulfilled");

  let attempted = 0;
  let succeeded = 0;

  for (const order of paidOrders ?? []) {
    attempted += 1;
    const result = await submitOrderToCj(order.id);
    if (result.success) succeeded += 1;
  }

  return NextResponse.json({ attempted, succeeded });
}
