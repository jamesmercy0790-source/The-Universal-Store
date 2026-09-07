import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseClient } from "../../../test/helpers/fakeSupabase";

let fakeClient: ReturnType<typeof createFakeSupabaseClient>;

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => fakeClient,
  createClient: async () => fakeClient
}));

// validateCheckoutLines is imported after the mock is registered above,
// so it picks up the faked createServiceRoleClient.
const { validateCheckoutLines } = await import("../pricing");

const PRODUCT_ID = "11111111-1111-1111-1111-111111111111";
const VARIANT_ID = "22222222-2222-2222-2222-222222222222";

function seedActiveProduct(overrides: Partial<Record<string, any>> = {}) {
  fakeClient = createFakeSupabaseClient({
    products: [
      {
        id: PRODUCT_ID,
        title: "Demo Hoodie",
        selling_price_cents: 3999,
        base_cost_cents: 1500,
        supplier_shipping_cost_cents: 300,
        margin_override_percent: null,
        category_id: null,
        status: "active",
        ...overrides.product
      }
    ],
    product_variants: [
      {
        id: VARIANT_ID,
        product_id: PRODUCT_ID,
        sku: "DEMO-M",
        price_delta_cents: 0,
        inventory_qty: 5,
        is_active: true,
        ...overrides.variant
      }
    ],
    product_destination_availability: [
      {
        product_id: PRODUCT_ID,
        country_code: "US",
        is_available: true,
        shipping_cost_cents: 699,
        ...overrides.availability
      }
    ]
  });
}

describe("validateCheckoutLines", () => {
  beforeEach(() => {
    seedActiveProduct();
  });

  it("derives the unit price from the database, never from anything the caller supplies", async () => {
    // CheckoutLineInput has no "price" field at all — there is nothing
    // for a manipulated client value to even occupy. This test proves
    // the derived price matches the DB row regardless.
    const { lines } = await validateCheckoutLines(
      [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 }],
      "US"
    );
    expect(lines[0]!.unitPriceUsdCents).toBe(3999);
  });

  it("rejects a manipulated/excessive quantity against real inventory (out-of-stock)", async () => {
    // Variant only has 5 in stock — requesting 999 must fail, not silently clamp or succeed.
    await expect(
      validateCheckoutLines([{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 999 }], "US")
    ).rejects.toThrow(/unavailable/i);
  });

  it("rejects an inactive/unpublished product", async () => {
    seedActiveProduct({ product: { status: "draft" } });
    await expect(
      validateCheckoutLines([{ productId: PRODUCT_ID, variantId: null, quantity: 1 }], "US")
    ).rejects.toThrow(/not available/i);
  });

  it("rejects an inactive variant even if the parent product is active", async () => {
    seedActiveProduct({ variant: { is_active: false } });
    await expect(
      validateCheckoutLines([{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 }], "US")
    ).rejects.toThrow(/unavailable/i);
  });

  it("blocks checkout for a destination with no confirmed availability row (never assumes shippable)", async () => {
    // Checking out to Nigeria, but only a US availability row was seeded.
    await expect(
      validateCheckoutLines([{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 }], "NG")
    ).rejects.toThrow(/cannot be shipped/i);
  });

  it("blocks checkout when a destination row exists but is explicitly marked unavailable", async () => {
    seedActiveProduct({ availability: { is_available: false } });
    await expect(
      validateCheckoutLines([{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 }], "US")
    ).rejects.toThrow(/cannot be shipped/i);
  });

  it("sums per-item shipping cost across quantity", async () => {
    const { shippingCents } = await validateCheckoutLines(
      [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 3 }],
      "US"
    );
    expect(shippingCents).toBe(699 * 3);
  });
});
