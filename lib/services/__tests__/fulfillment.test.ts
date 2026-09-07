import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseClient } from "../../../test/helpers/fakeSupabase";

let fakeClient: ReturnType<typeof createFakeSupabaseClient>;
let submitOrderMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => fakeClient
}));

vi.mock("@/lib/suppliers/cj/client", () => ({
  cjProvider: { submitOrder: (...args: any[]) => submitOrderMock(...args) }
}));

const { submitOrderToCj } = await import("../fulfillment");

const ORDER_ID = "order-1111";

function seed(overrides: Partial<Record<string, any>> = {}) {
  fakeClient = createFakeSupabaseClient({
    orders: [
      {
        id: ORDER_ID,
        order_number: "TUS-100001",
        email: "shopper@example.com",
        payment_status: "paid",
        country_code: "US",
        shipping_address_json: { fullName: "A Shopper", line1: "1 Main St", city: "Metropolis" },
        ...overrides.order
      }
    ],
    suppliers: [{ id: "supplier-cj", type: "cj" }],
    order_items: overrides.items ?? [
      { quantity: 1, variant_id: "variant-1", product_variants: { supplier_variant_id: "cj-vid-1" } }
    ],
    supplier_orders: overrides.supplierOrders ?? [],
    admin_notifications: []
  });
}

beforeEach(() => {
  submitOrderMock = vi.fn();
  seed();
});

describe("submitOrderToCj", () => {
  it("submits a paid order to CJ and updates order status from the mapped result", async () => {
    submitOrderMock.mockResolvedValue({ supplierOrderId: "cj-order-1", status: "UNSHIPPED" });

    const result = await submitOrderToCj(ORDER_ID);

    expect(result.success).toBe(true);
    expect(submitOrderMock).toHaveBeenCalledTimes(1);

    const supplierOrder = fakeClient.__store.supplier_orders.find((o) => o.order_id === ORDER_ID);
    expect(supplierOrder!.status).toBe("submitted");
    expect(supplierOrder!.supplier_order_id).toBe("cj-order-1");

    const order = fakeClient.__store.orders.find((o) => o.id === ORDER_ID);
    expect(order!.fulfillment_status).toBe("supplier_confirmed"); // UNSHIPPED, no sub-status

    const shipment = fakeClient.__store.shipments.find((s) => s.order_id === ORDER_ID);
    expect(shipment).toBeDefined();
  });

  it("is idempotent — a second call does not submit to CJ again", async () => {
    submitOrderMock.mockResolvedValue({ supplierOrderId: "cj-order-1", status: "UNSHIPPED" });

    await submitOrderToCj(ORDER_ID);
    const secondResult = await submitOrderToCj(ORDER_ID);

    expect(secondResult.alreadySubmitted).toBe(true);
    expect(submitOrderMock).toHaveBeenCalledTimes(1); // not called again
  });

  it("refuses to submit an order that isn't paid", async () => {
    seed({ order: { payment_status: "pending" } });

    const result = await submitOrderToCj(ORDER_ID);

    expect(result.success).toBe(false);
    expect(submitOrderMock).not.toHaveBeenCalled();
  });

  it("never marks the order fulfilled when CJ submission fails, and raises an admin notification", async () => {
    submitOrderMock.mockRejectedValue(new Error("CJ API error: destination not supported"));

    const result = await submitOrderToCj(ORDER_ID);

    expect(result.success).toBe(false);
    const order = fakeClient.__store.orders.find((o) => o.id === ORDER_ID);
    expect(order!.fulfillment_status).toBeUndefined(); // never set — stayed at whatever it was (unfulfilled default, not present in this fake seed)

    const supplierOrder = fakeClient.__store.supplier_orders.find((o) => o.order_id === ORDER_ID);
    expect(supplierOrder!.status).toBe("failed");

    const notifications = fakeClient.__store.admin_notifications;
    expect(notifications.some((n) => n.type === "cj_order_submission_failed")).toBe(true);
  });

  it("fails safely without calling CJ when an order item has no linked CJ variant", async () => {
    seed({ items: [{ quantity: 1, variant_id: "variant-1", product_variants: { supplier_variant_id: null } }] });

    const result = await submitOrderToCj(ORDER_ID);

    expect(result.success).toBe(false);
    expect(submitOrderMock).not.toHaveBeenCalled();
    const notifications = fakeClient.__store.admin_notifications;
    expect(notifications.some((n) => n.type === "cj_order_submission_failed")).toBe(true);
  });

  it("allows a retry after a prior failure", async () => {
    seed({ supplierOrders: [{ id: "so-1", order_id: ORDER_ID, status: "failed", retry_count: 1 }] });
    submitOrderMock.mockResolvedValue({ supplierOrderId: "cj-order-2", status: "SHIPPED" });

    const result = await submitOrderToCj(ORDER_ID);

    expect(result.success).toBe(true);
    expect(submitOrderMock).toHaveBeenCalledTimes(1);
    const supplierOrder = fakeClient.__store.supplier_orders.find((o) => o.order_id === ORDER_ID);
    expect(supplierOrder!.status).toBe("submitted");
    expect(supplierOrder!.retry_count).toBe(2);
  });
});
