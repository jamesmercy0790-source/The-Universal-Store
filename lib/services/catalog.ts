import { createServiceRoleClient } from "@/lib/supabase/server";

export type SortOption = "featured" | "newest" | "bestselling" | "price_asc" | "price_desc" | "rating";

export interface ProductListFilters {
  categorySlug?: string;
  quickFilter?: "new-arrivals" | "bestsellers" | "deals";
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

const PAGE_SIZE_DEFAULT = 24;

/**
 * Products are never hard-coded (Section 14) — every listing page reads
 * from Postgres through this one service so filter/sort/pagination logic
 * lives in exactly one place.
 */
export async function listProducts(filters: ProductListFilters = {}) {
  const supabase = createServiceRoleClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE_DEFAULT;

  let query = supabase
    .from("products")
    .select(
      "id, title, slug, selling_price_cents, compare_at_price_cents, currency_code, rating_avg, rating_count, is_new_arrival, is_bestseller, created_at, product_images(url, sort_order)",
      { count: "exact" }
    )
    .eq("status", "active");

  if (filters.categorySlug) {
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", filters.categorySlug)
      .maybeSingle();
    if (!category) return { products: [], total: 0 };
    query = query.eq("category_id", category.id);
  }

  if (filters.quickFilter === "new-arrivals") query = query.eq("is_new_arrival", true);
  if (filters.quickFilter === "bestsellers") query = query.eq("is_bestseller", true);
  if (filters.quickFilter === "deals") query = query.not("compare_at_price_cents", "is", null);

  if (filters.minPriceCents != null) query = query.gte("selling_price_cents", filters.minPriceCents);
  if (filters.maxPriceCents != null) query = query.lte("selling_price_cents", filters.maxPriceCents);

  switch (filters.sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "bestselling":
      query = query.order("is_bestseller", { ascending: false }).order("rating_count", { ascending: false });
      break;
    case "price_asc":
      query = query.order("selling_price_cents", { ascending: true });
      break;
    case "price_desc":
      query = query.order("selling_price_cents", { ascending: false });
      break;
    case "rating":
      query = query.order("rating_avg", { ascending: false });
      break;
    default:
      query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  const { data, count } = await query.range(from, from + pageSize - 1);

  return { products: data ?? [], total: count ?? 0 };
}

export async function getProductBySlug(slug: string) {
  const supabase = createServiceRoleClient();
  const { data: product } = await supabase
    .from("products")
    .select(
      "*, product_images(id, url, alt_text, sort_order, variant_id), product_variants(id, sku, option_values_json, price_delta_cents, inventory_qty, is_active), categories(name, slug)"
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  return product;
}

/** Destination availability for a single product — never assumed, always looked up. */
export async function getDestinationAvailability(productId: string, countryCode: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("product_destination_availability")
    .select("is_available, shipping_cost_cents, est_delivery_min_days, est_delivery_max_days, synced_at")
    .eq("product_id", productId)
    .eq("country_code", countryCode)
    .maybeSingle();

  // No row = availability has never been confirmed for this destination —
  // treated as unavailable, never assumed available (Section 6 / hard
  // constraint #2). This is what a product looks like before Phase 9's CJ
  // sync has run for it.
  if (!data) {
    return {
      isAvailable: false,
      shippingCostCents: null as number | null,
      estDeliveryMinDays: null as number | null,
      estDeliveryMaxDays: null as number | null,
      confirmed: false as const
    };
  }

  return {
    isAvailable: data.is_available,
    shippingCostCents: data.shipping_cost_cents,
    estDeliveryMinDays: data.est_delivery_min_days,
    estDeliveryMaxDays: data.est_delivery_max_days,
    confirmed: true as const
  };
}

export async function listCategories() {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export async function getCategoryBySlug(slug: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export async function searchProducts(term: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("products")
    .select("id, title, slug, selling_price_cents, currency_code, product_images(url, sort_order)")
    .eq("status", "active")
    .or(`title.ilike.%${term}%,short_description.ilike.%${term}%,tags.cs.{${term}}`)
    .limit(30);
  return data ?? [];
}
