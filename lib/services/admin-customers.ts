import { requireAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface AdminCustomerFilters {
  search?: string;
  page?: number;
}

const PAGE_SIZE = 40;

/**
 * Read-only by design — the brief only asked to view customers, not edit
 * their data (that stays under their own account settings, or a future
 * explicit admin-edit feature with its own audit trail). Every figure
 * here is a real aggregate from `orders`, never estimated.
 */
export async function listAdminCustomers(filters: AdminCustomerFilters = {}) {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const page = filters.page ?? 1;

  let query = supabase
    .from("profiles")
    .select("id, full_name, country_code, created_at", { count: "exact" })
    .eq("role", "customer")
    .order("created_at", { ascending: false });

  if (filters.search) query = query.ilike("full_name", `%${filters.search}%`);

  const from = (page - 1) * PAGE_SIZE;
  const { data: profiles, count } = await query.range(from, from + PAGE_SIZE - 1);

  // profiles doesn't store email (that lives on auth.users, not exposed
  // here) — orders.email is the closest reliable per-customer contact we
  // already have server-side, so it's used for display/search instead of
  // reaching into the auth schema.
  const customerIds = (profiles ?? []).map((p) => p.id);
  const { data: orderStats } = await supabase
    .from("orders")
    .select("user_id, email, total_cents, exchange_rate_snapshot, payment_status, created_at")
    .in("user_id", customerIds.length > 0 ? customerIds : ["00000000-0000-0000-0000-000000000000"]);

  const statsByUser = new Map<string, { email: string; orderCount: number; totalSpentUsdCents: number; lastOrderAt: string }>();
  for (const order of orderStats ?? []) {
    const existing = statsByUser.get(order.user_id) ?? {
      email: order.email,
      orderCount: 0,
      totalSpentUsdCents: 0,
      lastOrderAt: order.created_at
    };
    existing.orderCount += 1;
    if (order.payment_status === "paid") existing.totalSpentUsdCents += order.total_cents;
    if (order.created_at > existing.lastOrderAt) existing.lastOrderAt = order.created_at;
    statsByUser.set(order.user_id, existing);
  }

  const customers = (profiles ?? []).map((p) => ({
    ...p,
    ...(statsByUser.get(p.id) ?? { email: null, orderCount: 0, totalSpentUsdCents: 0, lastOrderAt: null })
  }));

  return { customers, total: count ?? 0 };
}

export async function getAdminCustomerDetail(customerId: string) {
  await requireAdmin();
  const supabase = createServiceRoleClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, country_code, currency_code, created_at")
    .eq("id", customerId)
    .maybeSingle();
  if (!profile) return null;

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, total_cents, exchange_rate_snapshot, currency_code, payment_status, created_at")
    .eq("user_id", customerId)
    .order("created_at", { ascending: false });

  const { data: addresses } = await supabase.from("addresses").select("*").eq("user_id", customerId);

  return { profile, orders: orders ?? [], addresses: addresses ?? [] };
}
