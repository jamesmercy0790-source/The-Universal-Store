import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseClient } from "../../../test/helpers/fakeSupabase";

let fakeClient: ReturnType<typeof createFakeSupabaseClient>;

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => fakeClient
}));

const { validateCoupon, incrementCouponUsage } = await import("../coupons");

function seedCoupon(overrides: Partial<Record<string, any>> = {}) {
  fakeClient = createFakeSupabaseClient({
    coupons: [
      {
        id: "coupon-1",
        code: "SAVE10",
        type: "percent",
        value: 10,
        starts_at: null,
        ends_at: null,
        usage_limit: null,
        usage_count: 0,
        min_order_amount_cents: 0,
        is_active: true,
        ...overrides
      }
    ]
  });
}

describe("validateCoupon", () => {
  beforeEach(() => seedCoupon());

  it("computes a percent discount off the server-derived subtotal", async () => {
    const result = await validateCoupon("SAVE10", 10000);
    expect(result.valid).toBe(true);
    expect(result.discountCents).toBe(1000);
  });

  it("computes a fixed discount", async () => {
    seedCoupon({ type: "fixed", value: 5 });
    const result = await validateCoupon("SAVE10", 10000);
    expect(result.discountCents).toBe(500);
  });

  it("is case-insensitive on the code", async () => {
    const result = await validateCoupon("save10", 10000);
    expect(result.valid).toBe(true);
  });

  it("rejects an inactive coupon", async () => {
    seedCoupon({ is_active: false });
    const result = await validateCoupon("SAVE10", 10000);
    expect(result.valid).toBe(false);
  });

  it("rejects a coupon that hasn't started yet", async () => {
    seedCoupon({ starts_at: new Date(Date.now() + 86_400_000).toISOString() });
    const result = await validateCoupon("SAVE10", 10000);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not active yet/i);
  });

  it("rejects an expired coupon", async () => {
    seedCoupon({ ends_at: new Date(Date.now() - 86_400_000).toISOString() });
    const result = await validateCoupon("SAVE10", 10000);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it("rejects a coupon at its usage limit", async () => {
    seedCoupon({ usage_limit: 5, usage_count: 5 });
    const result = await validateCoupon("SAVE10", 10000);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/usage limit/i);
  });

  it("rejects an order below the minimum amount", async () => {
    seedCoupon({ min_order_amount_cents: 20000 });
    const result = await validateCoupon("SAVE10", 10000);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/minimum order/i);
  });

  it("never discounts more than the subtotal itself", async () => {
    seedCoupon({ type: "fixed", value: 500 }); // $500 off a $10 order
    const result = await validateCoupon("SAVE10", 1000);
    expect(result.discountCents).toBe(1000);
  });

  it("rejects an unknown code", async () => {
    const result = await validateCoupon("DOESNOTEXIST", 10000);
    expect(result.valid).toBe(false);
  });
});

describe("incrementCouponUsage", () => {
  it("increments usage_count by one", async () => {
    seedCoupon({ usage_count: 3 });
    await incrementCouponUsage("coupon-1");
    const coupon = fakeClient.__store.coupons.find((c) => c.id === "coupon-1");
    expect(coupon!.usage_count).toBe(4);
  });
});
