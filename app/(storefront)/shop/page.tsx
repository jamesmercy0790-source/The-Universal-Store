import type { Metadata } from "next";
import { listProducts, type SortOption } from "@/lib/services/catalog";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { SortSelect } from "@/components/storefront/SortSelect";

export const metadata: Metadata = { title: "Shop" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ sort?: string; filter?: string }>;
}

const FILTER_TITLES: Record<string, string> = {
  "new-arrivals": "New Arrivals",
  bestsellers: "Best Sellers",
  deals: "Deals"
};

export default async function ShopPage({ searchParams }: Props) {
  const { sort, filter } = await searchParams;
  const quickFilter = filter as "new-arrivals" | "bestsellers" | "deals" | undefined;

  const { products, total } = await listProducts({
    sort: (sort as SortOption) ?? "featured",
    quickFilter
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-bone-100">
            {quickFilter ? FILTER_TITLES[quickFilter] ?? "Shop" : "Shop"}
          </h1>
          <p className="mt-1 text-sm text-bone-500">{total} product{total === 1 ? "" : "s"}</p>
        </div>
        <SortSelect />
      </div>
      <ProductGrid products={products} />
    </main>
  );
}
