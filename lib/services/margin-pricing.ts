import { createServiceRoleClient } from "@/lib/supabase/server";

const DEFAULT_MARGIN_PERCENT_FALLBACK = 30; // only used if `settings.pricing_rules` is somehow missing

/**
 * True profit margin, not markup: selling_price = total_cost / (1 - margin).
 * A 30% margin on a $13 total cost is $13 / 0.70 = $18.57 — gross profit
 * $5.57 (30% of the *selling* price), which is what "30% margin" means in
 * accounting terms. A markup of 30% on the same cost would only be
 * $16.90, a real difference the business owner explicitly called out.
 */
export function computeSellingPriceCents(totalCostCents: number, marginPercent: number): number {
  if (marginPercent >= 100 || marginPercent < 0) {
    throw new Error(`Invalid margin percent: ${marginPercent}. Must be between 0 and (exclusive) 100.`);
  }
  return Math.round(totalCostCents / (1 - marginPercent / 100));
}

export function computeGrossProfitCents(sellingPriceCents: number, totalCostCents: number): number {
  return sellingPriceCents - totalCostCents;
}

/**
 * Resolves the margin percent to use for a product: product override →
 * category override → global default (Section 11). Never silently
 * invents a number — if somehow nothing resolves (no global default
 * configured), falls back to a documented constant rather than throwing
 * mid-checkout.
 */
export async function resolveEffectiveMarginPercent(params: {
  productMarginOverride?: number | null;
  categoryId?: string | null;
}): Promise<number> {
  if (params.productMarginOverride != null) return Number(params.productMarginOverride);

  const supabase = createServiceRoleClient();

  if (params.categoryId) {
    const { data: category } = await supabase
      .from("categories")
      .select("margin_override_percent")
      .eq("id", params.categoryId)
      .maybeSingle();
    if (category?.margin_override_percent != null) return Number(category.margin_override_percent);
  }

  const { data: settingsRow } = await supabase
    .from("settings")
    .select("value_json")
    .eq("key", "pricing_rules")
    .maybeSingle();

  const globalDefault = (settingsRow?.value_json as { default_profit_margin_percent?: number } | undefined)
    ?.default_profit_margin_percent;

  return globalDefault ?? DEFAULT_MARGIN_PERCENT_FALLBACK;
}

export interface PricePreview {
  marginPercent: number;
  totalCostCents: number;
  sellingPriceCents: number;
  grossProfitCents: number;
}

/**
 * Full pricing computation for one product — used by the admin importer
 * (initial price) and the admin product editor (live preview when the
 * admin changes the margin). Supplier cost and shipping cost are taken
 * as given (the latest synced values, or a live preview value the admin
 * is trying out) — this function never fetches them itself, so it stays
 * usable for "what if" previews before anything is saved.
 */
export async function previewPrice(params: {
  supplierCostCents: number;
  supplierShippingCostCents: number;
  productMarginOverride?: number | null;
  categoryId?: string | null;
}): Promise<PricePreview> {
  const marginPercent = await resolveEffectiveMarginPercent({
    productMarginOverride: params.productMarginOverride,
    categoryId: params.categoryId
  });

  const totalCostCents = params.supplierCostCents + params.supplierShippingCostCents;
  const sellingPriceCents = computeSellingPriceCents(totalCostCents, marginPercent);
  const grossProfitCents = computeGrossProfitCents(sellingPriceCents, totalCostCents);

  return { marginPercent, totalCostCents, sellingPriceCents, grossProfitCents };
}

/** Reads the store-wide default margin — powers the admin settings display. */
export async function getGlobalDefaultMarginPercent(): Promise<number> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("settings").select("value_json").eq("key", "pricing_rules").maybeSingle();
  return (
    (data?.value_json as { default_profit_margin_percent?: number } | undefined)?.default_profit_margin_percent ??
    DEFAULT_MARGIN_PERCENT_FALLBACK
  );
}

export async function setGlobalDefaultMarginPercent(percent: number): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase.from("settings").select("value_json").eq("key", "pricing_rules").maybeSingle();
  const merged = { ...(existing?.value_json as object | undefined), default_profit_margin_percent: percent };
  await supabase.from("settings").upsert({ key: "pricing_rules", value_json: merged }, { onConflict: "key" });
}
