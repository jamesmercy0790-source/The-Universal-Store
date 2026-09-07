import Link from "next/link";
import type { Metadata } from "next";
import { getCart } from "@/lib/services/cart";
import { CartItemRow } from "@/components/storefront/CartItemRow";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Cart" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const { items, subtotalCents } = await getCart();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="mb-8 font-display text-3xl text-bone-100">Your Cart</h1>

      {items.length === 0 ? (
        <div className="rounded-sm border border-dashed border-ink-700 px-6 py-16 text-center">
          <p className="text-sm text-bone-500">Your cart is empty.</p>
          <Link href="/shop" className="mt-4 inline-block text-sm text-brass-400 hover:text-brass-300">
            Continue shopping →
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col">
            {items.map((item: any) => {
              const image = [...(item.products?.product_images ?? [])].sort(
                (a: any, b: any) => a.sort_order - b.sort_order
              )[0];
              return (
                <CartItemRow
                  key={item.id}
                  id={item.id}
                  title={item.products?.title ?? "Product"}
                  slug={item.products?.slug ?? "#"}
                  imageUrl={image?.url}
                  quantity={item.quantity}
                  priceCents={item.price_snapshot_cents}
                  currencyCode={item.products?.currency_code ?? "USD"}
                />
              );
            })}
          </div>

          <div className="mt-8 flex flex-col items-end gap-4">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-bone-500">Subtotal</p>
              <p className="font-display text-2xl text-bone-100">
                {(subtotalCents / 100).toFixed(2)} USD
              </p>
              <p className="mt-1 text-xs text-bone-500">
                Shipping and final total are calculated at checkout, per destination.
              </p>
            </div>
            <Link href="/checkout">
              <Button>Proceed to Checkout</Button>
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
