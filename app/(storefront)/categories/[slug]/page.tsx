import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, listProducts, type SortOption } from "@/lib/services/catalog";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { SortSelect } from "@/components/storefront/SortSelect";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  return { title: category?.name ?? "Category" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort } = await searchParams;

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const { products, total } = await listProducts({
    categorySlug: slug,
    sort: (sort as SortOption) ?? "featured"
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-bone-100">{category.name}</h1>
          <p className="mt-1 text-sm text-bone-500">{total} product{total === 1 ? "" : "s"}</p>
        </div>
        <SortSelect />
      </div>
      <ProductGrid products={products} />
    </main>
  );
}
