import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseClient } from "../../../test/helpers/fakeSupabase";

let fakeClient: ReturnType<typeof createFakeSupabaseClient>;
let verifyPaymentMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => fakeClient,
  createClient: async () => fakeClient
}));

// The real adapters call out to Paystack/Flutterwave over HTTP —
// verification is faked here so these tests exercise the reconciliation
// logic in orders.ts, not a live payment API.
vi.mock("@/lib/payments/router", () => ({
  getProviderById: () => ({ id: "paystack", verifyPayment: verifyPaymentMock })
}));

const { markOrderPaidFromWebhook } = await import("../orders");

const ORDER_ID = "order-1111";
const PAYMENT_ID = "payment-1111";
const REFERENCE = "TUS-100001-123";

function seed(orderOverrides: Partial<Record<string, any>> = {}, paymentOverrides: Partial<Record<string, any>> = {}) {
  fakeClient = createFakeSupabaseClient({
    orders: [
      {
        id: ORDER_ID,
        order_number: "TUS-100001",
        payment_status: "pending",
        ...orderOverrides
      }
    ],
    payments: [
      {
        id: PAYMENT_ID,
        order_id: ORDER_ID,
        provider: "paystack",
        provider_reference: REFERENCE,
        status: "pending",
        amount_cents: 5000,
        currency_code: "USD",
        ...paymentOverrides
      }
    ],
    admin_notifications: []
  });
}

beforeEach(() => {
  verifyPaymentMock = vi.fn();
  seed();
});

describe("markOrderPaidFromWebhook", () => {
  it("marks the order and payment paid on a verified successful payment", async () => {
    verifyPaymentMock.mockResolvedValue({
      status: "paid",
      amountCents: 5000,
      currency: "USD",
      providerReference: REFERENCE,
      raw: {}
    });

    await markOrderPaidFromWebhook({ provider: "paystack", providerReference: REFERENCE });

    const order = fakeClient.__store.orders.find((o) => o.id === ORDER_ID);
    const payment = fakeClient.__store.payments.find((p) => p.id === PAYMENT_ID);
    expect(order!.payment_status).toBe("paid");
    expect(payment!.status).toBe("paid");

    const notifications = fakeClient.__store.admin_notifications;
    expect(notifications.some((n) => n.type === "new_payment")).toBe(true);
  });

  it("marks the order failed on a verified failed payment, without touching pending->paid", async () => {
    verifyPaymentMock.mockResolvedValue({
      status: "failed",
      amountCents: 0,
      currency: "USD",
      providerReference: REFERENCE,
      raw: {}
    });

    await markOrderPaidFromWebhook({ provider: "paystack", providerReference: REFERENCE });

    const order = fakeClient.__store.orders.find((o) => o.id === ORDER_ID);
    expect(order!.payment_status).toBe("failed");

    const notifications = fakeClient.__store.admin_notifications;
    expect(notifications.some((n) => n.type === "failed_payment")).toBe(true);
  });

  it("leaves the order pending on an unresolved/abandoned verification result", async () => {
    verifyPaymentMock.mockResolvedValue({
      status: "pending",
      amountCents: 0,
      currency: "USD",
      providerReference: REFERENCE,
      raw: {}
    });

    await markOrderPaidFromWebhook({ provider: "paystack", providerReference: REFERENCE });

    const order = fakeClient.__store.orders.find((o) => o.id === ORDER_ID);
    expect(order!.payment_status).toBe("pending");
  });

  it("is a no-op for a duplicate webhook once the order is already paid (idempotency)", async () => {
    seed({ payment_status: "paid" }, { status: "paid" });
    verifyPaymentMock.mockResolvedValue({
      status: "paid",
      amountCents: 5000,
      currency: "USD",
      providerReference: REFERENCE,
      raw: {}
    });

    await markOrderPaidFromWebhook({ provider: "paystack", providerReference: REFERENCE });

    // No new admin notification should be created for a redelivered webhook.
    const notifications = fakeClient.__store.admin_notifications;
    expect(notifications.filter((n) => n.type === "new_payment")).toHaveLength(0);
  });

  it("still marks the order paid on an amount/currency mismatch, but flags it for manual review", async () => {
    // We expected 5000 USD; the provider confirms a different amount —
    // money was genuinely received, so the order still gets fulfilled,
    // but an admin notification must exist so it's reconciled by hand.
    verifyPaymentMock.mockResolvedValue({
      status: "paid",
      amountCents: 4500,
      currency: "USD",
      providerReference: REFERENCE,
      raw: {}
    });

    await markOrderPaidFromWebhook({ provider: "paystack", providerReference: REFERENCE });

    const order = fakeClient.__store.orders.find((o) => o.id === ORDER_ID);
    expect(order!.payment_status).toBe("paid");

    const notifications = fakeClient.__store.admin_notifications;
    expect(notifications.some((n) => n.type === "payment_mismatch")).toBe(true);
  });

  it("logs an unmatched-webhook event and makes no order changes when no payment row matches the reference", async () => {
    seed(); // fresh state
    verifyPaymentMock.mockResolvedValue({
      status: "paid",
      amountCents: 5000,
      currency: "USD",
      providerReference: "some-other-reference",
      raw: {}
    });

    await markOrderPaidFromWebhook({ provider: "paystack", providerReference: "some-other-reference" });

    const order = fakeClient.__store.orders.find((o) => o.id === ORDER_ID);
    expect(order!.payment_status).toBe("pending"); // untouched
  });
});
