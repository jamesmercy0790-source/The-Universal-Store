"use server";

import { requireAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { cjProvider } from "@/lib/suppliers/cj/client";
import { previewPrice } from "@/lib/services/margin-pricing";
import { logActivity } from "@/lib/services/activity";
import type { SupplierProductSummary } from "@/lib/suppliers/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

export interface CjSearchResultItem {
  supplierProductId: string;
  title: string;
  image: string | null;
  alreadyImported: boolean;
}

/** Search CJ's catalog. Admin-only — never callable from the storefront. */
export async function searchCjProducts(query: string, page = 1): Promise<CjSearchResultItem[]> {
  await requireAdmin();
  const results = await cjProvider.searchProducts(query, page);

  const service = createServiceRoleClient();
  const ids = results.map((r) => r.supplierProductId);
  const { data: existing } = await service.from("products").select("supplier_product_id").in("supplier_product_id", ids);
  const importedIds = new Set((existing ?? []).map((p) => p.supplier_product_id));

  return results.map((r) => ({
    supplierProductId: r.supplierProductId,
    title: r.title,
    image: r.images[0] ?? null,
    alreadyImported: importedIds.has(r.supplierProductId)
  }));
}

export interface CjProductPreview {
  detail: SupplierProductSummary;
  alreadyImported: boolean;
  existingProductSlug: string | null;
  pricePreviewFirstVariant: Awaited<ReturnType<typeof previewPrice>> | null;
}

/** Full detail for the admin "preview before import" step. */
export async function getCjProductPreview(
  supplierProductId: string,
  categoryId?: string | null
): Promise<CjProductPreview | null> {
  await requireAdmin();
  const detail = await cjProvider.getProduct(supplierProductId);
  if (!detail) return null;

  const service = createServiceRoleClient();
  const { data: existing } = await service
    .from("products")
    .select("slug")
    .eq("supplier_product_id", supplierProductId)
    .maybeSingle();

  const firstVariant = detail.variants[0];
  const pricePreviewFirstVariant = firstVariant
    ? await previewPrice({
        supplierCostCents: firstVariant.supplierCostCents,
        supplierShippingCostCents: 0, // no destination chosen yet at preview time — shipping cost is resolved per-country at import
        productMarginOverride: null,
        categoryId: categoryId ?? null
      })
    : null;

  return {
    detail,
    alreadyImported: Boolean(existing),
    existingProductSlug: existing?.slug ?? null,
    pricePreviewFirstVariant
  };
}

/** Live price recompute for the admin import form when the category (and therefore margin) selection changes. */
export async function previewImportPrice(supplierCostCents: number, categoryId: string | null) {
  await requireAdmin();
  return previewPrice({
    supplierCostCents,
    supplierShippingCostCents: 0,
    productMarginOverride: null,
    categoryId
  });
}

export interface ImportCjProductResult {
  success: boolean;
  error?: string;
  productId?: string;
  productSlug?: string;
}

/**
 * Imports one CJ product into the store catalog. Idempotent by
 * `supplier_product_id` — re-importing an already-imported product is
 * rejected rather than creating a duplicate (Section 1: "do not duplicate
 * CJ products"). Pricing is computed via the margin-pricing engine using
 * the target category's (or global) margin — never a hard-coded markup.
 * Destination availability is populated for every currently-supported
 * country via CJ's real freight calculation, never left assumed.
 */
export async function importCjProduct(params: {
  supplierProductId: string;
  categoryId: string;
  titleOverride?: string;
  descriptionOverride?: string;
}): Promise<ImportCjProductResult> {
  await requireAdmin();
  const service = createServiceRoleClient();

  const { data: existing } = await service
    .from("products")
    .select("id, slug")
    .eq("supplier_product_id", params.supplierProductId)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "This CJ product has already been imported.", productId: existing.id, productSlug: existing.slug };
  }

  const detail = await cjProvider.getProduct(params.supplierProductId);
  if (!detail || detail.variants.length === 0) {
    return { success: false, error: "CJ product not found or has no purchasable variants." };
  }

  // Base cost = cheapest variant's cost. Every variant is individually
  // margin-priced (see below), with the *difference* from the base
  // stored as price_delta_cents, so the schema's base+delta shape still
  // reflects true per-variant margin rather than one blanket price.
  const baseCostCents = Math.min(...detail.variants.map((v) => v.supplierCostCents));

  const basePrice = await previewPrice({
    supplierCostCents: baseCostCents,
    supplierShippingCostCents: 0,
    productMarginOverride: null,
    categoryId: params.categoryId
  });

  const { data: product, error: productError } = await service
    .from("products")
    .insert({
      supplier_id: (await service.from("suppliers").select("id").eq("type", "cj").maybeSingle()).data?.id ?? null,
      supplier_product_id: params.supplierProductId,
      title: params.titleOverride ?? detail.title,
      slug: slugify(params.titleOverride ?? detail.title),
      description: params.descriptionOverride ?? "",
      category_id: params.categoryId,
      base_cost_cents: baseCostCents,
      selling_price_cents: basePrice.sellingPriceCents,
      currency_code: "USD",
      status: "draft", // admin must explicitly publish — Section acceptance criteria step 8
      supplier_cost_updated_at: new Date().toISOString()
    })
    .select("id, slug")
    .single();

  if (productError || !product) {
    await logActivity({
      actorType: "system",
      eventType: "cj.import_failed",
      metadata: { supplierProductId: params.supplierProductId, error: productError?.message }
    });
    await service.from("admin_notifications").insert({
      type: "cj_import_failed",
      title: `CJ import failed for ${detail.title}`,
      body: productError?.message ?? "Unknown error creating the product record."
    });
    return { success: false, error: "Couldn't create the product record." };
  }

  for (const variant of detail.variants) {
    const variantPrice = await previewPrice({
      supplierCostCents: variant.supplierCostCents,
      supplierShippingCostCents: 0,
      productMarginOverride: null,
      categoryId: params.categoryId
    });
    await service.from("product_variants").insert({
      product_id: product.id,
      supplier_variant_id: variant.supplierVariantId,
      sku: variant.supplierVariantId,
      supplier_sku: variant.supplierVariantId,
      option_values_json: variant.optionValues,
      price_delta_cents: variantPrice.sellingPriceCents - basePrice.sellingPriceCents,
      inventory_qty: variant.inventoryQty,
      is_active: true,
      supplier_cost_synced_at: new Date().toISOString()
    });
  }

  if (detail.images.length > 0) {
    await service.from("product_images").insert(
      detail.images.map((url, i) => ({ product_id: product.id, url, sort_order: i }))
    );
  }

  await logActivity({
    actorType: "admin",
    eventType: "admin.cj_product_imported",
    entityType: "product",
    entityId: product.id,
    metadata: { supplierProductId: params.supplierProductId }
  });

  // Populate destination availability for every currently-supported
  // country using CJ's real freight calculation — never left assumed.
  // Sequential with a short delay: CJ's documented rate limit is 1
  // request/second across all endpoints.
  const { data: countries } = await service.from("countries").select("code").eq("supported", true);
  for (const country of countries ?? []) {
    try {
      const availability = await cjProvider.checkDestinationAvailability(params.supplierProductId, country.code);
      await service.from("product_destination_availability").upsert(
        {
          product_id: product.id,
          country_code: country.code,
          is_available: availability.isAvailable,
          shipping_cost_cents: availability.shippingCostCents ?? null,
          est_delivery_min_days: availability.estDeliveryMinDays ?? null,
          est_delivery_max_days: availability.estDeliveryMaxDays ?? null,
          synced_at: new Date().toISOString()
        },
        { onConflict: "product_id,country_code" }
      );
    } catch (err) {
      await logActivity({
        actorType: "system",
        eventType: "cj.freight_calc_failed",
        entityType: "product",
        entityId: product.id,
        metadata: { country: country.code, error: err instanceof Error ? err.message : String(err) }
      });
      // Leave no row for this country rather than guessing — matches the
      // "no row = not available" rule everywhere else in the app.
    }
    await sleep(1100);
  }

  return { success: true, productId: product.id, productSlug: product.slug };
}
