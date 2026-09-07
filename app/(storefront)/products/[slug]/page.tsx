import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import {
  getProductBySlug,
  getDestinationAvailability,
  listProducts
} from "@/lib/services/catalog";
import { getShopperLocale } from "@/lib/services/geo";
import { logActivity } from "@/lib/services/activity";
import { ProductOptions } from "@/components/storefront/ProductOptions";
import { ProductGrid } from "@/components/storefront/ProductGrid";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return {
    title: product?.title ?? "Product",
    description: product?.short_description ?? undefined
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const { countryCode } = await getShopperLocale();

  const availability = countryCode
    ? await getDestinationAvailability(product.id, countryCode)
    : null;

  // destinationConfirmedAvailable: null = no country selected yet (blocks
  // purchase with an honest message), otherwise the confirmed true/false
  // from product_destination_availability — never assumed (hard constraint #2).
  const destinationConfirmedAvailable = countryCode ? availability!.isAvailable : null;

  void logActivity({
    actorType: "customer",
    eventType: "product.viewed",
    entityType: "product",
    entityId: product.id
  });

  const images = [...(product.product_images ?? [])].sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  );

  const { products: related } = await listProducts({
    categorySlug: product.categories?.slug,
    pageSize: 4
  });
  const relatedFiltered = related.filter((p: any) => p.id !== product.id);

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square overflow-hidden rounded-sm bg-ink-900">
            {images[0] ? (
              <Image src={images[0].url} alt={images[0].alt_text ?? product.title} fill className="object-cover" priority />
            ) : null}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {images.slice(1, 5).map((img: any) => (
                <div key={img.id} className="relative aspect-square overflow-hidden rounded-sm bg-ink-900">
                  <Image src={img.url} alt={img.alt_text ?? product.title} fill className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {product.categories?.name && (
            <span className="text-xs uppercase tracking-[0.2em] text-brass-400">
              {product.categories.name}
            </span>
          )}
          <h1 className="font-display text-3xl text-bone-100">{product.title}</h1>

          <div className="flex items-baseline gap-3">
            <span className="text-xl text-bone-100">
              {(product.selling_price_cents / 100).toFixed(2)} {product.currency_code}
            </span>
            {product.compare_at_price_cents && (
              <span className="text-sm text-bone-700 line-through">
                {(product.compare_at_price_cents / 100).toFixed(2)} {product.currency_code}
              </span>
            )}
            {product.rating_count > 0 && (
              <span className="text-xs text-bone-500">
                ★ {product.rating_avg.toFixed(1)} ({product.rating_count})
              </span>
            )}
          </div>

          {product.short_description && (
            <p className="text-sm text-bone-300">{product.short_description}</p>
          )}

          <div className="rounded-sm border border-ink-700 bg-ink-900 px-4 py-3 text-sm">
            {!countryCode ? (
              <p className="text-bone-500">
                <a href="/onboarding/country" className="text-brass-400 hover:text-brass-300">
                  Select your country
                </a>{" "}
                to see shipping availability and delivery estimates.
              </p>
            ) : availability?.isAvailable ? (
              <div className="text-bone-300">
                <p>Ships to {countryCode}.</p>
                {availability.shippingCostCents != null && (
                  <p className="mt-1 text-bone-500">
                    Shipping: {(availability.shippingCostCents / 100).toFixed(2)} USD
                    {availability.estDeliveryMinDays && availability.estDeliveryMaxDays
                      ? ` · Estimated delivery: ${availability.estDeliveryMinDays}–${availability.estDeliveryMaxDays} days`
                      : ""}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-signal-warning">
                This product is currently unavailable for delivery to {countryCode}.
              </p>
            )}
          </div>

          <ProductOptions
            productId={product.id}
            variants={product.product_variants ?? []}
            destinationConfirmedAvailable={destinationConfirmedAvailable}
          />

          {product.description && (
            <div className="mt-4 border-t border-ink-800 pt-4 text-sm text-bone-400">
              <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Details</h2>
              <p className="whitespace-pre-line">{product.description}</p>
            </div>
          )}
        </div>
      </div>

      {relatedFiltered.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 font-display text-2xl text-bone-100">You may also like</h2>
          <ProductGrid products={relatedFiltered} />
        </section>
      )}
    </main>
  );
}
