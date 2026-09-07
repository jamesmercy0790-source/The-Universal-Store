/**
 * Supplier abstraction (Section 37). CJdropshipping is the first
 * implementation; adding a second supplier later means writing one new
 * adapter that implements this same contract — checkout, orders, and the
 * database shape don't change, since every supplier-linked row already
 * carries a `supplier_id`.
 */

export interface SupplierProductSummary {
  supplierProductId: string;
  title: string;
  images: string[];
  variants: Array<{
    supplierVariantId: string;
    optionValues: Record<string, string>;
    supplierCostCents: number;
    inventoryQty: number;
  }>;
}

export interface ProductProvider {
  /** Search the supplier's catalog — powers the admin import UI (Section 38). */
  searchProducts(query: string, page?: number): Promise<SupplierProductSummary[]>;
  getProduct(supplierProductId: string): Promise<SupplierProductSummary | null>;
}

export interface InventoryProvider {
  getInventory(supplierVariantId: string): Promise<{ qty: number }>;
  /** Bulk variant, used by the scheduled sync job rather than one-by-one polling. */
  getInventoryBulk(supplierVariantIds: string[]): Promise<Record<string, number>>;
}

export interface DestinationAvailability {
  isAvailable: boolean;
  shippingCostCents?: number;
  estDeliveryMinDays?: number;
  estDeliveryMaxDays?: number;
}

export interface ShippingProvider {
  /** Called at PDP render (cached) and again at checkout (authoritative). */
  checkDestinationAvailability(
    supplierProductId: string,
    countryCode: string
  ): Promise<DestinationAvailability>;
}

export interface FulfillmentOrderInput {
  internalOrderId: string;
  orderNumber: string;
  shippingAddress: {
    fullName: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    countryCode: string;
    phone?: string;
  };
  items: Array<{ supplierVariantId: string; quantity: number }>;
}

export interface FulfillmentResult {
  supplierOrderId: string;
  status: string;
}

export interface FulfillmentProvider {
  /** Only ever called after payment is confirmed — see lib/services/orders.ts. */
  submitOrder(input: FulfillmentOrderInput): Promise<FulfillmentResult>;
  cancelOrder(supplierOrderId: string): Promise<{ success: boolean }>;
}

export interface TrackingUpdate {
  status: string;
  description?: string;
  occurredAt: string;
  carrier?: string;
  trackingNumber?: string;
}

export interface TrackingProvider {
  getTrackingUpdates(supplierOrderId: string): Promise<TrackingUpdate[]>;
}

export interface Supplier
  extends ProductProvider,
    InventoryProvider,
    ShippingProvider,
    FulfillmentProvider,
    TrackingProvider {
  readonly id: string;
}
