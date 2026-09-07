import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getOrderForCustomer } from "@/lib/services/orders";
import { convertUsdCents } from "@/lib/currency/service";
import { OrderStatusTimeline } from "@/components/storefront/OrderStatusTimeline";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id}` };
}

export default async function OrderDetailPage({ params }: Props) {
  const { id: orderNumber } = await params;

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/account/login?redirect=/account/orders/${orderNumber}`);
  }

  const order = await getOrderForCustomer(orderNumber);
  if (!order) notFound();

  const displayTotal = convertUsdCents(order.total_cents, order.exchange_rate_snapshot);
  const address = order.shipping_address_json as Record<string, string> | null;
  const shipment = order.shipments?.[0];

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Order</span>
          <h1 className="mt-1 font-display text-3xl text-bone-100">{order.order_number}</h1>
          <p className="mt-1 text-xs text-bone-500">
            Placed {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>
        <Link href="/account/orders" className="text-sm text-brass-400 hover:text-brass-300">
          ← All orders
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-sm border border-ink-700 bg-ink-900 p-6">
          <h2 className="mb-4 text-xs uppercase tracking-wide text-bone-500">Status</h2>
          <OrderStatusTimeline
            paymentStatus={order.payment_status}
            fulfillmentStatus={order.fulfillment_status}
            shippingStatus={order.shipping_status}
          />

          {shipment && (
            <div className="mt-6 border-t border-ink-800 pt-4 text-sm text-bone-300">
              <p className="text-xs uppercase tracking-wide text-bone-500">Tracking</p>
              <p className="mt-1">
                {shipment.carrier ?? "Carrier"} — {shipment.tracking_number ?? "No tracking number yet"}
              </p>
              {shipment.tracking_url && (
                <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer" className="text-brass-400 hover:text-brass-300">
                  Track shipment →
                </a>
              )}
              {shipment.tracking_events?.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5 text-xs text-bone-500">
                  {shipment.tracking_events
                    .sort((a: any, b: any) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
                    .map((event: any) => (
                      <li key={event.id}>
                        {new Date(event.occurred_at).toLocaleString()} — {event.status}
                        {event.description ? `: ${event.description}` : ""}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="rounded-sm border border-ink-700 bg-ink-900 p-6">
          <h2 className="mb-4 text-xs uppercase tracking-wide text-bone-500">Shipping to</h2>
          {address && (
            <address className="text-sm not-italic text-bone-300">
              {address.fullName}
              <br />
              {address.line1}
              {address.line2 ? <>, {address.line2}</> : null}
              <br />
              {address.city}
              {address.state ? `, ${address.state}` : ""} {address.postalCode ?? ""}
              <br />
              {order.country_code}
            </address>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-sm border border-ink-700 bg-ink-900 p-6">
        <h2 className="mb-4 text-xs uppercase tracking-wide text-bone-500">Items</h2>
        <div className="flex flex-col divide-y divide-ink-800">
          {order.order_items?.map((item: any) => (
            <div key={item.id} className="flex justify-between py-3 text-sm">
              <span className="text-bone-300">
                {item.title_snapshot} × {item.quantity}
              </span>
              <span className="text-bone-100">{((item.unit_price_cents * item.quantity) / 100).toFixed(2)} USD</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-1 border-t border-ink-800 pt-4 text-sm text-bone-400">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{(order.subtotal_cents / 100).toFixed(2)} USD</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{(order.shipping_cents / 100).toFixed(2)} USD</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{(order.tax_cents / 100).toFixed(2)} USD</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-ink-800 pt-2 text-bone-100">
            <span>Total</span>
            <span>
              {(displayTotal / 100).toFixed(2)} {order.currency_code}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
