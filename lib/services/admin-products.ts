"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { previewPrice, resolveEffectiveMarginPercent, computeGrossProfitCents } from "@/lib/services/margin-pricing";
import { logActivity } from "@/lib/services/activity";

export interface AdminProductListFilters {
  search?: string;
  status?: "draft" | "active" | "archived";
  categoryId?: string;
  sort?: "newest" | "oldest" | "title" | "price_asc" | "price_desc";
  page?: number;
}

const PAGE_SIZE = 30;

export async function listAdminProducts(filters: AdminProductListFilters = {}) {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const page = filters.page ?? 1;

  let query = supabase
    .from("products")
    .select(
      "id, title, slug, status, is_featured, selling_price_cents, base_cost_cents, supplier_shipping_cost_cents, margin_override_percent, category_id, supplier_product_id, supplier_sync_status, categories(name), product_variants(id, inventory_qty)",
      { count: "exact" }
    );

  if (filters.search) query = query.ilike("title", `%${filters.search}%`);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);

  switch (filters.sort) {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "title":
      query = query.order("title", { ascending: true });
      break;
    case "price_asc":
      query = query.order("selling_price_cents", { ascending: true });
      break;
    case "price_desc":
      query = query.order("selling_price_cents", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);

  return { products: data ?? [], total: count ?? 0 };
}

export async function getAdminProduct(productId: string) {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { data: product } = await supabase
    .from("products")
    .select(
      "*, categories(id, name), product_variants(id, sku, supplier_variant_id, option_values_json, price_delta_cents, inventory_qty, is_active), product_images(id, url, alt_text, sort_order)"
    )
    .eq("id", productId)
    .maybeSingle();

  if (!product) return null;

  const marginPercent = await resolveEffectiveMarginPercent({
    productMarginOverride: product.margin_override_percent,
    categoryId: product.category_id
  });
  const totalCostCents = product.base_cost_cents + product.supplier_shipping_cost_cents;
  const grossProfitCents = computeGrossProfitCents(product.selling_price_cents, totalCostCents);

  return { product, marginPercent, totalCostCents, grossProfitCents };
}

export async function previewProductPrice(
  supplierCostCents: number,
  supplierShippingCostCents: number,
  marginOverride: number | null,
  categoryId: string | null
) {
  await requireAdmin();
  return previewPrice({ supplierCostCents, supplierShippingCostCents, productMarginOverride: marginOverride, categoryId });
}

export interface UpdateProductInput {
  title?: string;
  description?: string;
  categoryId?: string;
  sellingPriceCents?: number;
  marginOverridePercent?: number | null;
  isFeatured?: boolean;
}

export interface AdminActionResult {
  success: boolean;
  error?: string;
}

async function logAdminChange(productId: string, event: string, metadata: Record<string, unknown> = {}) {
  const { user } = await requireAdmin();
  await logActivity({ actorType: "admin", actorId: user.id, eventType: event, entityType: "product", entityId: productId, metadata });
}

export async function updateProduct(productId: string, input: UpdateProductInput): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createServiceRoleClient();

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.sellingPriceCents !== undefined) patch.selling_price_cents = input.sellingPriceCents;
  if (input.marginOverridePercent !== undefined) patch.margin_override_percent = input.marginOverridePercent;
  if (input.isFeatured !== undefined) patch.is_featured = input.isFeatured;

  const { error } = await supabase.from("products").update(patch).eq("id", productId);
  if (error) return { success: false, error: error.message };

  await logAdminChange(productId, "admin.product_updated", { fields: Object.keys(patch) });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  return { success: true };
}

export async function setProductStatus(
  productId: string,
  status: "draft" | "active" | "archived"
): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("products").update({ status }).eq("id", productId);
  if (error) return { success: false, error: error.message };

  await logAdminChange(productId, "admin.product_status_changed", { status });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  return { success: true };
}

export async function setVariantActive(variantId: string, isActive: boolean): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { data: variant, error } = await supabase
    .from("product_variants")
    .update({ is_active: isActive })
    .eq("id", variantId)
    .select("product_id")
    .single();
  if (error || !variant) return { success: false, error: error?.message ?? "Variant not found." };

  await logAdminChange(variant.product_id, "admin.variant_visibility_changed", { variantId, isActive });
  revalidatePath(`/admin/products/${variant.product_id}`);
  return { success: true };
}
