import { notFound } from "next/navigation";
import { getAdminOrderDetail } from "@/lib/services/admin-orders";
import { convertUsdCents } from "@/lib/currency/service";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { orderNumber } = await params;
  const result = await getAdminOrderDetail(orderNumber);
  if (!result) notFound();
  const { order, timeline, relatedNotifications } = result;

  const address = order.shipping_address_json as Record<string, string> | null;
  const supplierOrder = order.supplier_orders?.[0];
  const shipment = order.shipments?.[0];
  const displayTotal = convertUsdCents(order.total_cents, order.exchange_rate_snapshot);

  const totalSupplierCost = (order.order_items ?? []).reduce(
    (sum: number, i: any) => sum + (i.supplier_cost_cents + i.supplier_shipping_cost_cents) * i.quantity,
    0
  );
  const totalRevenue = (order.order_items ?? []).reduce((sum: number, i: any) => sum + i.unit_price_cents * i.quantity, 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-bone-100">{order.order_number}</h1>
          <p className="text-xs text-bone-500">Placed {new Date(order.created_at).toLocaleString()}</p>
        </div>
        <div className="text-right text-sm">
          <span className="capitalize text-bone-300">{order.payment_status}</span>
          <span className="mx-2 text-bone-700">·</span>
          <span className="capitalize text-bone-300">{order.fulfillment_status}</span>
          <span className="mx-2 text-bone-700">·</span>
          <span className="capitalize text-bone-300">{order.shipping_status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-sm border border-ink-700 bg-ink-900 p-5">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Customer</h2>
          <p className="text-sm text-bone-300">{order.email}</p>
          <p className="text-sm text-bone-300">{order.phone}</p>
          {address && (
            <address className="mt-2 text-sm not-italic text-bone-400">
              {address.fullName}
              <br />
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
              <br />
              {address.city}
              {address.state ? `, ${address.state}` : ""} {address.postalCode ?? ""}
              <br />
              {order.country_code}
            </address>
          )}
        </section>

        <section className="rounded-sm border border-ink-700 bg-ink-900 p-5">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Payment</h2>
          {(order.payments ?? []).map((p: any) => (
            <div key={p.id} className="text-sm text-bone-300">
              <p className="capitalize">
                {p.provider} — {p.status}
              </p>
              <p className="text-bone-500">
                {(p.amount_cents / 100).toFixed(2)} {p.currency_code}
              </p>
              <p className="text-xs text-bone-600">{p.provider_reference}</p>
            </div>
          ))}
          <p className="mt-3 text-xs text-bone-600">
            Payment status can only change via provider webhook verification — no manual override exists,
            by design.
          </p>
        </section>

        <section className="rounded-sm border border-ink-700 bg-ink-900 p-5">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">CJ Fulfillment</h2>
          {supplierOrder ? (
            <div className="text-sm text-bone-300">
              <p>CJ order: {supplierOrder.supplier_order_id ?? "not yet submitted"}</p>
              <p>Store status: {supplierOrder.status}</p>
              <p>CJ status: {supplierOrder.cj_order_status ?? "—"}</p>
              {supplierOrder.last_error && <p className="text-signal-danger">{supplierOrder.last_error}</p>}
              <p className="text-xs text-bone-600">Retries: {supplierOrder.retry_count}</p>
            </div>
          ) : (
            <p className="text-sm text-bone-500">Not yet submitted to CJ.</p>
          )}
          {shipment && (
            <div className="mt-3 border-t border-ink-800 pt-3 text-sm text-bone-300">
              <p>Tracking: {shipment.tracking_number ?? "—"}</p>
              <p>Carrier: {shipment.carrier ?? "—"}</p>
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-sm border border-ink-700 bg-ink-900 p-5">
        <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Items &amp; Profit</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-bone-500">
            <tr>
              <th className="py-2">Product</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Sold at</th>
              <th className="py-2">Supplier cost</th>
              <th className="py-2">Margin used</th>
              <th className="py-2">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800 text-bone-300">
            {(order.order_items ?? []).map((item: any) => (
              <tr key={item.id}>
                <td className="py-2">{item.title_snapshot}</td>
                <td className="py-2">{item.quantity}</td>
                <td className="py-2">{(item.unit_price_cents / 100).toFixed(2)} USD</td>
                <td className="py-2">{((item.supplier_cost_cents + item.supplier_shipping_cost_cents) / 100).toFixed(2)} USD</td>
                <td className="py-2">{item.margin_percent_used}%</td>
                <td className="py-2 text-signal-success">{(item.gross_profit_cents / 100).toFixed(2)} USD</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-ink-800 pt-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-bone-500">Subtotal</p>
            <p className="text-bone-100">{(order.subtotal_cents / 100).toFixed(2)} USD</p>
          </div>
          <div>
            <p className="text-xs uppercase text-bone-500">Tax</p>
            <p className="text-bone-100">{(order.tax_cents / 100).toFixed(2)} USD</p>
          </div>
          <div>
            <p className="text-xs uppercase text-bone-500">Total (display)</p>
            <p className="text-bone-100">
              {(displayTotal / 100).toFixed(2)} {order.currency_code}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-bone-500">Total profit</p>
            <p className="text-signal-success">{((totalRevenue - totalSupplierCost) / 100).toFixed(2)} USD</p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-sm border border-ink-700 bg-ink-900 p-5">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Timeline</h2>
          <ul className="flex flex-col gap-2 text-xs text-bone-400">
            {timeline.map((t: any) => (
              <li key={t.id}>
                {new Date(t.created_at).toLocaleString()} — {t.event_type}
              </li>
            ))}
            {timeline.length === 0 && <li className="text-bone-600">No activity logged yet.</li>}
          </ul>
        </section>

        <section className="rounded-sm border border-ink-700 bg-ink-900 p-5">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Notifications &amp; errors</h2>
          <ul className="flex flex-col gap-2 text-xs">
            {relatedNotifications.map((n: any) => (
              <li key={n.id} className={n.type.includes("failed") ? "text-signal-danger" : "text-bone-400"}>
                {n.title}
              </li>
            ))}
            {relatedNotifications.length === 0 && <li className="text-bone-600">Nothing flagged.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
