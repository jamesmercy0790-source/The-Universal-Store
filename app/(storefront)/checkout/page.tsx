import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCheckoutSummary } from "@/lib/services/checkout";
import { CheckoutForm } from "@/components/storefront/CheckoutForm";
import { CouponForm } from "@/components/storefront/CouponForm";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ coupon?: string }>;
}

export default async function CheckoutPage({ searchParams }: Props) {
  const { coupon } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/account/login?redirect=/checkout");
  }

  const result = await getCheckoutSummary(coupon);

  if (!result.success) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Checkout</span>
        <p className="text-sm text-bone-300">{result.error}</p>
        <div className="flex gap-4 text-sm">
          <Link href="/cart" className="text-brass-400 hover:text-brass-300">
            Back to cart
          </Link>
          <Link href="/onboarding/country" className="text-brass-400 hover:text-brass-300">
            Set country
          </Link>
        </div>
      </main>
    );
  }

  const { summary } = result;

  return (
    <main className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-6 py-16 lg:grid-cols-2">
      <div>
        <h1 className="mb-6 font-display text-3xl text-bone-100">Shipping</h1>
        <CheckoutForm couponCode={summary.couponCode} />
      </div>

      <div className="rounded-sm border border-ink-700 bg-ink-900 p-6">
        <h2 className="mb-4 font-display text-xl text-bone-100">Order Summary</h2>

        <CouponForm appliedCode={summary.couponCode} error={summary.couponError} />

        <div className="flex flex-col gap-2 border-b border-ink-800 pb-4 text-sm">
          {summary.lines.map((line) => (
            <div key={`${line.productId}-${line.variantId ?? "base"}`} className="flex justify-between text-bone-300">
              <span>
                {line.titleSnapshot} × {line.quantity}
              </span>
              <span>{(line.lineTotalUsdCents / 100).toFixed(2)} USD</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 py-4 text-sm text-bone-400">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{(summary.subtotalUsdCents / 100).toFixed(2)} USD</span>
          </div>
          {summary.discountUsdCents > 0 && (
            <div className="flex justify-between text-signal-success">
              <span>Discount</span>
              <span>−{(summary.discountUsdCents / 100).toFixed(2)} USD</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{(summary.shippingUsdCents / 100).toFixed(2)} USD</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{(summary.taxUsdCents / 100).toFixed(2)} USD</span>
          </div>
        </div>

        <div className="flex justify-between border-t border-ink-800 pt-4">
          <span className="text-bone-100">Total</span>
          <div className="text-right">
            <p className="font-display text-xl text-bone-100">
              {(summary.totalDisplayCents / 100).toFixed(2)} {summary.currencyCode}
            </p>
            {summary.currencyCode !== "USD" && (
              <p className="text-xs text-bone-500">
                ({(summary.totalUsdCents / 100).toFixed(2)} USD at time of order)
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
