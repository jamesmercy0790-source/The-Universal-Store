import Link from "next/link";
import type { Metadata } from "next";
import { getWishlist } from "@/lib/services/wishlist";
import { WishlistItemRow } from "@/components/storefront/WishlistItemRow";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Wishlist" };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const { signedIn, items } = await getWishlist();

  if (!signedIn) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Wishlist</span>
        <h1 className="font-display text-2xl text-bone-100">Sign in to see your wishlist</h1>
        <p className="text-sm text-bone-500">
          Your wishlist is saved to your account so it's there whenever you come back.
        </p>
        <Link href="/account/login?redirect=/wishlist">
          <Button>Sign in</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="mb-8 font-display text-3xl text-bone-100">Your Wishlist</h1>

      {items.length === 0 ? (
        <div className="rounded-sm border border-dashed border-ink-700 px-6 py-16 text-center">
          <p className="text-sm text-bone-500">Nothing saved yet.</p>
          <Link href="/shop" className="mt-4 inline-block text-sm text-brass-400 hover:text-brass-300">
            Browse products →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col">
          {items.map((item: any) => {
            const image = [...(item.products?.product_images ?? [])].sort(
              (a: any, b: any) => a.sort_order - b.sort_order
            )[0];
            return (
              <WishlistItemRow
                key={item.id}
                id={item.id}
                title={item.products?.title ?? "Product"}
                slug={item.products?.slug ?? "#"}
                imageUrl={image?.url}
                priceCents={item.products?.selling_price_cents ?? 0}
                currencyCode={item.products?.currency_code ?? "USD"}
                isActive={item.products?.status === "active"}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
