import { requireAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface AdminOrderFilters {
  paymentStatus?: string;
  fulfillmentStatus?: string;
  search?: string; // matches order_number or email
  page?: number;
}

const PAGE_SIZE = 40;

export async function listAdminOrders(filters: AdminOrderFilters = {}) {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const page = filters.page ?? 1;

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, email, country_code, currency_code, total_cents, exchange_rate_snapshot, payment_status, fulfillment_status, shipping_status, created_at, order_items(id), supplier_orders(supplier_order_id, cj_order_status)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (filters.paymentStatus) query = query.eq("payment_status", filters.paymentStatus);
  if (filters.fulfillmentStatus) query = query.eq("fulfillment_status", filters.fulfillmentStatus);
  if (filters.search) query = query.or(`order_number.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);

  return { orders: data ?? [], total: count ?? 0 };
}

export async function getAdminOrderDetail(orderNumber: string) {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "*, order_items(*, products(title)), payments(*), supplier_orders(*), shipments(*, tracking_events(*))"
    )
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) return null;

  const { data: timeline } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("entity_type", "order")
    .eq("entity_id", order.id)
    .order("created_at", { ascending: false });

  // admin_notifications has no FK to orders yet (see HANDOFF.md) — matched
  // the same way the admin notifications page already does, by the
  // TUS-###### pattern in the title/body text.
  const { data: allNotifications } = await supabase
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const relatedNotifications = (allNotifications ?? []).filter(
    (n) => n.title?.includes(order.order_number) || n.body?.includes(order.order_number)
  );

  return { order, timeline: timeline ?? [], relatedNotifications };
}
