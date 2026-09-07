import type { FulfillmentStatus, ShippingStatus } from "@/lib/order-status";

/**
 * CJ's documented order statuses (developers.cjdropshipping.cn/en/api/api2/api/shopping.html):
 * CREATED, IN_CART, UNPAID, PENDING, PROCESSING, UNSHIPPED, SHIPPED,
 * DELIVERED, CANCELLED, OTHER — with PENDING/PROCESSING documented as
 * sub-statuses that can appear alongside UNSHIPPED.
 *
 * This is the ONLY place CJ status strings get translated into this
 * store's own `fulfillment_status`/`shipping_status` — per the explicit
 * requirement "do not blindly map... create an explicit mapping layer,"
 * nothing else should compare a raw CJ status string directly.
 */

export interface CjStatusMappingResult {
  /** null = don't change the existing value — we don't know what this means yet. */
  fulfillmentStatus: FulfillmentStatus | null;
  shippingStatus: ShippingStatus | null;
  /** True for anything unrecognized — the caller must raise this for admin review, never silently apply a guess. */
  needsAdminReview: boolean;
}

const KNOWN_STATUSES = new Set([
  "CREATED",
  "IN_CART",
  "UNPAID",
  "PENDING",
  "PROCESSING",
  "UNSHIPPED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED"
]);

export function mapCjOrderStatus(cjStatus: string, cjSubStatus?: string | null): CjStatusMappingResult {
  const status = (cjStatus ?? "").toUpperCase();
  const subStatus = (cjSubStatus ?? "").toUpperCase();

  if (!KNOWN_STATUSES.has(status)) {
    // Covers CJ's own "OTHER" bucket and anything genuinely unrecognized
    // (a new status CJ adds later, a typo, etc.) — flagged, not guessed.
    return { fulfillmentStatus: null, shippingStatus: null, needsAdminReview: true };
  }

  switch (status) {
    case "CREATED":
    case "IN_CART":
    case "UNPAID":
      // We've told CJ about the order, but CJ hasn't confirmed/processed
      // payment on their side yet.
      return { fulfillmentStatus: "submitted_to_supplier", shippingStatus: "pending", needsAdminReview: false };

    case "UNSHIPPED":
      if (subStatus === "PROCESSING") {
        return { fulfillmentStatus: "fulfilling", shippingStatus: "pending", needsAdminReview: false };
      }
      // subStatus PENDING, or no sub-status at all — CJ has accepted the
      // order but hasn't started active fulfillment yet.
      return { fulfillmentStatus: "supplier_confirmed", shippingStatus: "pending", needsAdminReview: false };

    // These two sub-statuses can also arrive as the top-level status in
    // some CJ responses — treated the same as UNSHIPPED + that sub-status.
    case "PENDING":
      return { fulfillmentStatus: "supplier_confirmed", shippingStatus: "pending", needsAdminReview: false };
    case "PROCESSING":
      return { fulfillmentStatus: "fulfilling", shippingStatus: "pending", needsAdminReview: false };

    case "SHIPPED":
      return { fulfillmentStatus: "fulfilling", shippingStatus: "shipped", needsAdminReview: false };

    case "DELIVERED":
      return { fulfillmentStatus: "fulfilling", shippingStatus: "delivered", needsAdminReview: false };

    case "CANCELLED":
      return { fulfillmentStatus: "failed", shippingStatus: "cancelled", needsAdminReview: false };

    default:
      // Unreachable given the KNOWN_STATUSES guard above, but keeps this
      // function honest under future edits rather than falling through
      // to an unspecified return.
      return { fulfillmentStatus: null, shippingStatus: null, needsAdminReview: true };
  }
}
