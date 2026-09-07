import Link from "next/link";
import type { Metadata } from "next";
import { listCategories } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="mb-8 font-display text-3xl text-bone-100">Categories</h1>

      {categories.length === 0 ? (
        <p className="rounded-sm border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-bone-500">
          No categories are published yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="flex items-center justify-center rounded-sm border border-ink-700 bg-ink-900 px-4 py-8 text-center text-sm text-bone-300 transition-colors hover:border-brass-500 hover:text-brass-400"
            >
              {category.name}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
