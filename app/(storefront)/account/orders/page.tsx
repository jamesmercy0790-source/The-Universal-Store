import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listOrdersForCustomer } from "@/lib/services/orders";
import { convertUsdCents } from "@/lib/currency/service";

export const metadata: Metadata = { title: "Your Orders" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
  refund_pending: "Refund pending",
  refunded: "Refunded"
};

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/account/login?redirect=/account/orders");
  }

  const orders = await listOrdersForCustomer();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-8 font-display text-3xl text-bone-100">Your Orders</h1>

      {orders.length === 0 ? (
        <div className="rounded-sm border border-dashed border-ink-700 px-6 py-16 text-center">
          <p className="text-sm text-bone-500">You haven't placed any orders yet.</p>
          <Link href="/shop" className="mt-4 inline-block text-sm text-brass-400 hover:text-brass-300">
            Start shopping →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order: any) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.order_number}`}
              className="flex items-center justify-between rounded-sm border border-ink-700 bg-ink-900 px-5 py-4 hover:border-brass-500"
            >
              <div>
                <p className="text-sm text-bone-100">{order.order_number}</p>
                <p className="text-xs text-bone-500">
                  {new Date(order.created_at).toLocaleDateString()} · {order.order_items?.length ?? 0} item
                  {order.order_items?.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-bone-100">
                  {(convertUsdCents(order.total_cents, order.exchange_rate_snapshot) / 100).toFixed(2)}{" "}
                  {order.currency_code}
                </p>
                <p className="text-xs text-bone-500">{STATUS_LABEL[order.payment_status] ?? order.payment_status}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
