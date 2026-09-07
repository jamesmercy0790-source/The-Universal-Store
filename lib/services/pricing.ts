import { createServiceRoleClient } from "@/lib/supabase/server";
import { getCurrentRate, convertUsdCents } from "@/lib/currency/service";
import { resolveEffectiveMarginPercent, computeGrossProfitCents } from "@/lib/services/margin-pricing";

// The markup-rule pricing draft from Phase 5 has been superseded by the
// true-profit-margin engine in lib/services/margin-pricing.ts (Section
// 10-11 of the CJ integration requirements) — selling_price_cents is
// computed and written there (at import time and whenever the admin
// changes a margin), not recomputed inline here. This file only
// consumes the already-stored selling_price_cents for checkout
// validation.

export interface CheckoutLineInput {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface ValidatedLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPriceUsdCents: number;
  titleSnapshot: string;
  skuSnapshot: string | null;
  supplierCostCents: number;
  supplierShippingCostCents: number;
  marginPercentUsed: number;
  grossProfitCents: number; // per unit
}

/**
 * Re-derives every line's price and availability directly from the
 * database at checkout time. The checkout Server Action must call this
 * and use ONLY its output for the charge — client-submitted totals are a
 * display hint, never a source of truth (Section 20/56).
 */
export async function validateCheckoutLines(
  lines: CheckoutLineInput[],
  countryCode: string
): Promise<{ lines: ValidatedLine[]; shippingCents: number }> {
  const supabase = createServiceRoleClient();
  const validated: ValidatedLine[] = [];
  let shippingCents = 0;

  for (const line of lines) {
    const { data: product } = await supabase
      .from("products")
      .select(
        "id, title, selling_price_cents, base_cost_cents, supplier_shipping_cost_cents, margin_override_percent, category_id, status"
      )
      .eq("id", line.productId)
      .single();

    if (!product || product.status !== "active") {
      throw new Error(`Product ${line.productId} is not available for purchase.`);
    }

    let variantSku: string | null = null;
    let priceDeltaCents = 0;
    if (line.variantId) {
      const { data: variant } = await supabase
        .from("product_variants")
        .select("sku, price_delta_cents, inventory_qty, is_active")
        .eq("id", line.variantId)
        .single();

      if (!variant || !variant.is_active || variant.inventory_qty < line.quantity) {
        throw new Error(`Variant ${line.variantId} is unavailable at the requested quantity.`);
      }
      variantSku = variant.sku;
      priceDeltaCents = variant.price_delta_cents;
    }

    const { data: availability } = await supabase
      .from("product_destination_availability")
      .select("is_available, shipping_cost_cents")
      .eq("product_id", line.productId)
      .eq("country_code", countryCode)
      .maybeSingle();

    if (!availability?.is_available) {
      throw new Error(`Product ${line.productId} cannot be shipped to ${countryCode}.`);
    }

    shippingCents += (availability.shipping_cost_cents ?? 0) * line.quantity;

    // Snapshot the margin/profit picture as it stands right now (Section
    // 15) — this never changes retroactively even if the product's cost
    // or the global/category margin changes after this order exists.
    const marginPercentUsed = await resolveEffectiveMarginPercent({
      productMarginOverride: product.margin_override_percent,
      categoryId: product.category_id
    });
    const unitPriceUsdCents = product.selling_price_cents + priceDeltaCents;
    const grossProfitCents = computeGrossProfitCents(
      unitPriceUsdCents,
      product.base_cost_cents + product.supplier_shipping_cost_cents
    );

    validated.push({
      productId: product.id,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPriceUsdCents,
      titleSnapshot: product.title,
      skuSnapshot: variantSku,
      supplierCostCents: product.base_cost_cents,
      supplierShippingCostCents: product.supplier_shipping_cost_cents,
      marginPercentUsed,
      grossProfitCents
    });
  }

  return { lines: validated, shippingCents };
}

/** Converts a validated USD total into the customer's display currency, snapshotting the rate. */
export async function toDisplayCurrency(amountUsdCents: number, currencyCode: string) {
  const rate = await getCurrentRate(currencyCode);
  return { amount: convertUsdCents(amountUsdCents, rate), rate };
}
