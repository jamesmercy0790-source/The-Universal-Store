import Link from "next/link";
import Image from "next/image";

export interface ProductGridItem {
  id: string;
  title: string;
  slug: string;
  selling_price_cents: number;
  currency_code: string;
  compare_at_price_cents?: number | null;
  product_images?: { url: string; sort_order: number }[] | null;
}

export function ProductGrid({ products }: { products: ProductGridItem[] }) {
  if (products.length === 0) {
    return (
      <p className="rounded-sm border border-dashed border-ink-700 px-6 py-16 text-center text-sm text-bone-500">
        No products match yet — the catalog is populated via supplier import in the admin
        dashboard.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => {
        const image = [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
        return (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            className="flex flex-col gap-2 rounded-sm border border-ink-700 bg-ink-900 p-4 hover:border-brass-500"
          >
            <div className="relative aspect-square overflow-hidden rounded-sm bg-ink-800">
              {image ? (
                <Image src={image.url} alt={product.title} fill className="object-cover" />
              ) : null}
            </div>
            <span className="text-sm text-bone-100">{product.title}</span>
            <span className="flex items-baseline gap-2 text-xs text-bone-500">
              <span>{(product.selling_price_cents / 100).toFixed(2)} {product.currency_code}</span>
              {product.compare_at_price_cents ? (
                <span className="text-bone-700 line-through">
                  {(product.compare_at_price_cents / 100).toFixed(2)}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
