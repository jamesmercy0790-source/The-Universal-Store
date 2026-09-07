import { describe, it, expect } from "vitest";
import { mapCjOrderStatus } from "../status-mapping";

describe("mapCjOrderStatus", () => {
  it.each([
    ["CREATED", undefined, "submitted_to_supplier", "pending"],
    ["IN_CART", undefined, "submitted_to_supplier", "pending"],
    ["UNPAID", undefined, "submitted_to_supplier", "pending"],
    ["UNSHIPPED", undefined, "supplier_confirmed", "pending"],
    ["UNSHIPPED", "PENDING", "supplier_confirmed", "pending"],
    ["UNSHIPPED", "PROCESSING", "fulfilling", "pending"],
    ["PENDING", undefined, "supplier_confirmed", "pending"],
    ["PROCESSING", undefined, "fulfilling", "pending"],
    ["SHIPPED", undefined, "fulfilling", "shipped"],
    ["DELIVERED", undefined, "fulfilling", "delivered"],
    ["CANCELLED", undefined, "failed", "cancelled"]
  ])("maps CJ status %s (sub-status %s) to fulfillment=%s / shipping=%s", (status, sub, expectedFulfillment, expectedShipping) => {
    const result = mapCjOrderStatus(status, sub);
    expect(result.needsAdminReview).toBe(false);
    expect(result.fulfillmentStatus).toBe(expectedFulfillment);
    expect(result.shippingStatus).toBe(expectedShipping);
  });

  it("flags CJ's own OTHER status for admin review instead of guessing", () => {
    const result = mapCjOrderStatus("OTHER");
    expect(result.needsAdminReview).toBe(true);
    expect(result.fulfillmentStatus).toBeNull();
    expect(result.shippingStatus).toBeNull();
  });

  it("flags a genuinely unrecognized status string for admin review rather than defaulting silently", () => {
    const result = mapCjOrderStatus("SOME_NEW_STATUS_CJ_ADDS_LATER");
    expect(result.needsAdminReview).toBe(true);
  });

  it("is case-insensitive, since we shouldn't trust CJ's casing to be perfectly consistent", () => {
    const result = mapCjOrderStatus("shipped");
    expect(result.needsAdminReview).toBe(false);
    expect(result.shippingStatus).toBe("shipped");
  });
});
