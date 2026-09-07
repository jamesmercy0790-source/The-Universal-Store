import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function CategoryRail() {
  const supabase = createServiceRoleClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .is("parent_id", null)
    .order("sort_order")
    .limit(8);

  if (!categories || categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-14">
      <h2 className="mb-6 font-display text-2xl text-bone-100">Shop our top categories</h2>
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
    </section>
  );
}
