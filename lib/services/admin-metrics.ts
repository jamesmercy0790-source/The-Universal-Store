import { requireAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface AdminOverviewMetrics {
  totalOrders: number;
  paidOrders: number;
  pendingPayments: number;
  failedPayments: number;
  totalRevenueUsdCents: number; // sum of paid orders' total_cents — always USD base, safe to sum across display currencies
}

/**
 * Every figure here is a real aggregate query against `orders` — nothing
 * is estimated, sampled, or seeded. With zero real orders placed, this
 * honestly returns zeros rather than showing placeholder numbers dressed
 * up as business analytics (hard constraint #5).
 */
export async function getAdminOverviewMetrics(): Promise<AdminOverviewMetrics> {
  await requireAdmin();
  const supabase = createServiceRoleClient();

  const { count: totalOrders } = await supabase.from("orders").select("id", { count: "exact", head: true });
  const { count: paidOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("payment_status", "paid");
  const { count: pendingPayments } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("payment_status", "pending");
  const { count: failedPayments } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("payment_status", "failed");

  const { data: paidTotals } = await supabase.from("orders").select("total_cents").eq("payment_status", "paid");
  const totalRevenueUsdCents = (paidTotals ?? []).reduce((sum, o) => sum + o.total_cents, 0);

  return {
    totalOrders: totalOrders ?? 0,
    paidOrders: paidOrders ?? 0,
    pendingPayments: pendingPayments ?? 0,
    failedPayments: failedPayments ?? 0,
    totalRevenueUsdCents
  };
}
