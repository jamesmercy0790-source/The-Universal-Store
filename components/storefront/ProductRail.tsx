import { createServiceRoleClient } from "@/lib/supabase/server";
import { ProductGrid } from "@/components/storefront/ProductGrid";

interface Props {
  title: string;
  flag: "is_featured" | "is_new_arrival" | "is_bestseller";
}

export async function ProductRail({ title, flag }: Props) {
  const supabase = createServiceRoleClient();
  const { data: products } = await supabase
    .from("products")
    .select(
      "id, title, slug, selling_price_cents, compare_at_price_cents, currency_code, product_images(url, sort_order)"
    )
    .eq("status", "active")
    .eq(flag, true)
    .limit(8);

  return (
    <section className="mx-auto max-w-7xl px-6 py-14">
      <h2 className="mb-6 font-display text-2xl text-bone-100">{title}</h2>
      <ProductGrid products={products ?? []} />
    </section>
  );
}
