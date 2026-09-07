import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseClient } from "../../../test/helpers/fakeSupabase";

let fakeClient: ReturnType<typeof createFakeSupabaseClient>;
let redirectMock: ReturnType<typeof vi.fn>;

const USER = { id: "user-1111", email: "shopper@example.com" };

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => fakeClient,
  createClient: async () => fakeClient
}));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => USER
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectMock(url);
    // Mirrors Next's real behavior of aborting execution via a thrown signal.
    throw new Error(`REDIRECT:${url}`);
  }
}));

// checkout.ts's own DB writes (orders/order_items/payments) go through the
// fake Supabase client above; everything it *reads* through other
// services is mocked at the service boundary, since those services have
// their own dedicated test files (pricing.test.ts, router.test.ts, etc.)
// — this file is testing checkout.ts's own orchestration and idempotency.
vi.mock("@/lib/services/cart", () => ({
  getCart: async () => ({
    items: [{ product_id: "prod-1", variant_id: null, quantity: 1 }],
    subtotalCents: 3999,
    cartId: "cart-1"
  })
}));
vi.mock("@/lib/services/geo", () => ({
  getShopperLocale: async () => ({ countryCode: "US", currencyCode: "USD", isSignedIn: true })
}));
vi.mock("@/lib/services/pricing", () => ({
  validateCheckoutLines: async () => ({
    lines: [
      {
        productId: "prod-1",
        variantId: null,
        quantity: 1,
        unitPriceUsdCents: 3999,
        titleSnapshot: "Demo Hoodie",
        skuSnapshot: "DEMO-M",
        supplierCostCents: 1500
      }
    ],
    shippingCents: 699
  })
}));
vi.mock("@/lib/services/tax", () => ({
  getTaxRatePercent: async () => 0,
  calculateTaxCents: () => 0
}));
vi.mock("@/lib/currency/service", () => ({
  getCurrentRate: async () => 1,
  convertUsdCents: (usd: number) => usd
}));

let selectPaymentProviderMock: ReturnType<typeof vi.fn>;
vi.mock("@/lib/payments/router", async () => {
  const actual = await vi.importActual<typeof import("../../payments/router")>("../../payments/router");
  return {
    ...actual,
    selectPaymentProvider: (...args: any[]) => selectPaymentProviderMock(...args)
  };
});

const { placeOrder } = await import("../checkout");
const { UnsupportedPaymentRouteError } = await import("../../payments/router");

beforeEach(() => {
  redirectMock = vi.fn();
  fakeClient = createFakeSupabaseClient({ orders: [], order_items: [], payments: [] });
});

describe("placeOrder", () => {
  it("creates an order, a payment session, and redirects to the provider on a valid checkout", async () => {
    const createPaymentSession = vi
      .fn()
      .mockResolvedValue({ provider: "flutterwave", authorizationUrl: "https://pay.example/session/abc", providerReference: "ref-abc" });
    selectPaymentProviderMock = vi.fn().mockReturnValue({ id: "flutterwave", createPaymentSession });

    await expect(
      placeOrder({ fullName: "A Shopper", line1: "1 Main St", city: "Metropolis" }, "idem-key-1")
    ).rejects.toThrow("REDIRECT:https://pay.example/session/abc");

    expect(fakeClient.__store.orders).toHaveLength(1);
    expect(fakeClient.__store.orders[0]!.idempotency_key).toBe("idem-key-1");
    expect(fakeClient.__store.payments).toHaveLength(1);
    expect(createPaymentSession).toHaveBeenCalledTimes(1);
  });

  it("does not create a second order/charge when retried with the same idempotency key", async () => {
    fakeClient = createFakeSupabaseClient({
      orders: [{ id: "existing-order", order_number: "TUS-999999", idempotency_key: "idem-key-2", user_id: USER.id }],
      order_items: [],
      payments: []
    });
    selectPaymentProviderMock = vi.fn(); // must never be called on the idempotent-repeat path

    await expect(
      placeOrder({ fullName: "A Shopper", line1: "1 Main St", city: "Metropolis" }, "idem-key-2")
    ).rejects.toThrow("REDIRECT:/checkout/return?order=TUS-999999");

    expect(fakeClient.__store.orders).toHaveLength(1); // still just the one
    expect(selectPaymentProviderMock).not.toHaveBeenCalled();
  });

  it("returns a clean error instead of creating an order when no provider supports the currency/country", async () => {
    selectPaymentProviderMock = vi.fn(() => {
      throw new UnsupportedPaymentRouteError("US", "XYZ");
    });

    const result = await placeOrder({ fullName: "A Shopper", line1: "1 Main St", city: "Metropolis" }, "idem-key-3");

    expect(result).toEqual({ success: false, error: expect.stringMatching(/no configured payment provider/i) });
    expect(fakeClient.__store.orders).toHaveLength(0);
  });
});
