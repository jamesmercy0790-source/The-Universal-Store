import Link from "next/link";
import { listAdminOrders } from "@/lib/services/admin-orders";
import { convertUsdCents } from "@/lib/currency/service";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ q?: string; payment?: string; fulfillment?: string }>;
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const { q, payment, fulfillment } = await searchParams;
  const { orders, total } = await listAdminOrders({
    search: q,
    paymentStatus: payment,
    fulfillmentStatus: fulfillment
  });

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl text-bone-100">Orders ({total})</h1>

      <form className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search order # or email…"
          className="rounded-sm border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-bone-100 outline-none focus:border-brass-500"
        />
      </form>

      <div className="overflow-x-auto rounded-sm border border-ink-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900 text-xs uppercase tracking-wide text-bone-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Fulfillment</th>
              <th className="px-4 py-3">Shipping</th>
              <th className="px-4 py-3">CJ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {orders.map((o: any) => (
              <tr key={o.id} className="text-bone-300">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o.order_number}`} className="text-bone-100 hover:text-brass-400">
                    {o.order_number}
                  </Link>
                </td>
                <td className="px-4 py-3">{o.email}</td>
                <td className="px-4 py-3">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  {(convertUsdCents(o.total_cents, o.exchange_rate_snapshot) / 100).toFixed(2)} {o.currency_code}
                </td>
                <td className="px-4 py-3 capitalize">{o.payment_status}</td>
                <td className="px-4 py-3 capitalize">{o.fulfillment_status}</td>
                <td className="px-4 py-3 capitalize">{o.shipping_status}</td>
                <td className="px-4 py-3">{o.supplier_orders?.[0]?.supplier_order_id ?? "—"}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-bone-500">
                  No orders match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
