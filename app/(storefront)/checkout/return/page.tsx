import Link from "next/link";
import type { Metadata } from "next";
import { getOrderForCustomer } from "@/lib/services/orders";

export const metadata: Metadata = { title: "Order status" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ order?: string }>;
}

/**
 * The customer lands here after the payment provider's hosted checkout
 * redirects back — but this page only ever *reads* the order's current
 * state. It never sets payment_status itself: a browser redirect can be
 * spoofed or interrupted, so the webhook (verified against the
 * provider's API directly) is the only thing allowed to mark an order
 * paid. If the webhook hasn't landed yet, this honestly says so instead
 * of guessing.
 */
export default async function CheckoutReturnPage({ searchParams }: Props) {
  const { order: orderNumber } = await searchParams;

  if (!orderNumber) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <p className="text-sm text-bone-500">No order reference was provided.</p>
        <Link href="/shop" className="text-brass-400 hover:text-brass-300">
          Continue shopping →
        </Link>
      </main>
    );
  }

  const order = await getOrderForCustomer(orderNumber);

  if (!order) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <p className="text-sm text-bone-500">We couldn't find that order on your account.</p>
        <Link href="/account" className="text-brass-400 hover:text-brass-300">
          Go to your account →
        </Link>
      </main>
    );
  }

  const statusMessage =
    order.payment_status === "paid"
      ? { label: "Payment confirmed", tone: "text-signal-success" }
      : order.payment_status === "failed"
        ? { label: "Payment failed", tone: "text-signal-danger" }
        : { label: "Confirming your payment…", tone: "text-signal-warning" };

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Order {order.order_number}</span>
      <h1 className={`font-display text-2xl ${statusMessage.tone}`}>{statusMessage.label}</h1>

      {order.payment_status === "pending" && (
        <p className="max-w-sm text-sm text-bone-500">
          We're waiting for final confirmation from your payment provider — this page doesn't set your
          order's status itself, so refresh in a moment if it doesn't update automatically.
        </p>
      )}

      <p className="text-sm text-bone-500">
        Total: {(order.total_cents / 100).toFixed(2)} USD
      </p>

      <div className="flex gap-4 text-sm">
        <Link href={`/account/orders/${order.order_number}`} className="text-brass-400 hover:text-brass-300">
          View order
        </Link>
        <Link href="/shop" className="text-brass-400 hover:text-brass-300">
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
