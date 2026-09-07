import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseClient } from "../../../test/helpers/fakeSupabase";

let fakeClient: ReturnType<typeof createFakeSupabaseClient>;

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => fakeClient
}));

const {
  computeSellingPriceCents,
  computeGrossProfitCents,
  resolveEffectiveMarginPercent,
  previewPrice
} = await import("../margin-pricing");

describe("computeSellingPriceCents (true profit margin, not markup)", () => {
  it("matches the worked example from the spec: $13 cost at 30% margin -> $18.57", () => {
    // $13.00 total cost, 30% margin: 1300 / 0.70 = 1857.14... -> rounds to 1857 cents.
    expect(computeSellingPriceCents(1300, 30)).toBe(1857);
  });

  it("is NOT the same as a simple 30% markup ($16.90)", () => {
    const trueMarginPrice = computeSellingPriceCents(1300, 30);
    const naiveMarkupPrice = Math.round(1300 * 1.3); // 1690
    expect(trueMarginPrice).not.toBe(naiveMarkupPrice);
    expect(trueMarginPrice).toBeGreaterThan(naiveMarkupPrice);
  });

  it("rejects a 100%+ margin (division by zero or negative)", () => {
    expect(() => computeSellingPriceCents(1000, 100)).toThrow();
    expect(() => computeSellingPriceCents(1000, 150)).toThrow();
  });

  it("rejects a negative margin", () => {
    expect(() => computeSellingPriceCents(1000, -5)).toThrow();
  });

  it("a 0% margin returns exactly the cost", () => {
    expect(computeSellingPriceCents(1000, 0)).toBe(1000);
  });
});

describe("computeGrossProfitCents", () => {
  it("is selling price minus total cost", () => {
    expect(computeGrossProfitCents(1857, 1300)).toBe(557);
  });
});

describe("resolveEffectiveMarginPercent (product -> category -> global priority)", () => {
  beforeEach(() => {
    fakeClient = createFakeSupabaseClient({
      categories: [{ id: "cat-electronics", margin_override_percent: 25 }],
      settings: [{ key: "pricing_rules", value_json: { default_profit_margin_percent: 30 } }]
    });
  });

  it("uses the product override when present, ignoring category and global", () => {
    return resolveEffectiveMarginPercent({ productMarginOverride: 45, categoryId: "cat-electronics" }).then(
      (margin) => expect(margin).toBe(45)
    );
  });

  it("falls back to the category override when there is no product override", async () => {
    const margin = await resolveEffectiveMarginPercent({ productMarginOverride: null, categoryId: "cat-electronics" });
    expect(margin).toBe(25);
  });

  it("falls back to the global default when neither product nor category has an override", async () => {
    const margin = await resolveEffectiveMarginPercent({ productMarginOverride: null, categoryId: "cat-uncategorized" });
    expect(margin).toBe(30);
  });

  it("falls back to the global default when no categoryId is given at all", async () => {
    const margin = await resolveEffectiveMarginPercent({ productMarginOverride: null, categoryId: null });
    expect(margin).toBe(30);
  });
});

describe("previewPrice", () => {
  beforeEach(() => {
    fakeClient = createFakeSupabaseClient({
      categories: [{ id: "cat-fashion", margin_override_percent: 35 }],
      settings: [{ key: "pricing_rules", value_json: { default_profit_margin_percent: 30 } }]
    });
  });

  it("combines supplier cost + shipping cost as total cost before applying margin", async () => {
    const result = await previewPrice({
      supplierCostCents: 1000,
      supplierShippingCostCents: 300,
      productMarginOverride: null,
      categoryId: "cat-fashion"
    });
    // total cost 1300, margin 35% (category override) -> 1300 / 0.65 = 2000
    expect(result.marginPercent).toBe(35);
    expect(result.totalCostCents).toBe(1300);
    expect(result.sellingPriceCents).toBe(2000);
    expect(result.grossProfitCents).toBe(700);
  });

  it("a product-specific override wins even inside a margin-mapped category", async () => {
    const result = await previewPrice({
      supplierCostCents: 1000,
      supplierShippingCostCents: 300,
      productMarginOverride: 50,
      categoryId: "cat-fashion"
    });
    expect(result.marginPercent).toBe(50);
    expect(result.sellingPriceCents).toBe(2600); // 1300 / 0.5
  });
});
