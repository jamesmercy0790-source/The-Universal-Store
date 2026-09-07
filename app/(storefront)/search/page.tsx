import type { Metadata } from "next";
import { searchProducts } from "@/lib/services/catalog";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { SearchBox } from "@/components/storefront/SearchBox";
import { logActivity } from "@/lib/services/activity";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const term = q?.trim();

  const products = term ? await searchProducts(term) : [];

  if (term) {
    // Fire-and-forget — a slow log write should never hold up the page.
    void logActivity({
      actorType: "customer",
      eventType: "search.performed",
      metadata: { term, result_count: products.length }
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="mb-6 text-center font-display text-3xl text-bone-100">Search</h1>
      <div className="mb-10">
        <SearchBox />
      </div>

      {term ? (
        <>
          <p className="mb-4 text-sm text-bone-500">
            {products.length} result{products.length === 1 ? "" : "s"} for "{term}"
          </p>
          <ProductGrid products={products} />
        </>
      ) : (
        <p className="text-center text-sm text-bone-500">Enter a search term to get started.</p>
      )}
    </main>
  );
}
