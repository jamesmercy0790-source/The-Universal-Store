import type {
  Supplier,
  SupplierProductSummary,
  DestinationAvailability,
  FulfillmentOrderInput,
  FulfillmentResult,
  TrackingUpdate
} from "../types";
import { getValidCjAccessToken } from "./auth";
import { logActivity } from "@/lib/services/activity";

/**
 * CJdropshipping adapter — authentication AND the business endpoints
 * below are implemented against CJ's current published API 2.0 docs
 * (developers.cjdropshipping.cn/en/api/api2/), fetched and read before
 * writing each one:
 *   - Product search:      GET  /product/listV2
 *   - Product detail:      GET  /product/query
 *   - Freight calculation: POST /logistic/freightCalculate
 *   - Order creation:      POST /shopping/order/createOrderV2
 *   - Order status/track:  GET  /shopping/order/getOrderDetail
 *
 * `getInventoryBulk` and `cancelOrder` are still scaffolded — CJ exposes
 * dedicated inventory-by-SKU/by-product endpoints and an order-delete
 * endpoint that this file doesn't yet call, since I hadn't pulled their
 * exact contracts before this pass. Everything below only uses fields
 * I've actually seen in CJ's documented responses.
 */

const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

class CjNotConfiguredError extends Error {
  constructor(method: string) {
    super(
      `CJ adapter method "${method}" is not yet wired to a live endpoint — ` +
        `its exact contract hasn't been confirmed against CJ's current docs yet. ` +
        `See lib/suppliers/cj/client.ts.`
    );
    this.name = "CjNotConfiguredError";
  }
}

async function cjGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const accessToken = await getValidCjAccessToken();
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

  const res = await fetch(`${CJ_BASE_URL}${path}${query ? `?${query}` : ""}`, {
    headers: { "CJ-Access-Token": accessToken }
  });
  const body = await res.json();

  if (!res.ok || body.result === false) {
    await logActivity({
      actorType: "system",
      eventType: "cj.request_failed",
      metadata: { path, code: body.code, message: body.message }
    });
    throw new Error(`CJ API error at ${path}: ${body.message ?? res.statusText}`);
  }
  return body.data as T;
}

async function cjPost<T>(path: string, payload: unknown): Promise<T> {
  const accessToken = await getValidCjAccessToken();
  const res = await fetch(`${CJ_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CJ-Access-Token": accessToken },
    body: JSON.stringify(payload)
  });
  const body = await res.json();

  if (!res.ok || body.result === false) {
    await logActivity({
      actorType: "system",
      eventType: "cj.request_failed",
      metadata: { path, code: body.code, message: body.message }
    });
    throw new Error(`CJ API error at ${path}: ${body.message ?? res.statusText}`);
  }
  return body.data as T;
}

// ── Product search (listV2) ────────────────────────────────────────────
interface CjListV2Product {
  id: string;
  nameEn: string;
  bigImage: string;
  sellPrice: string;
  oneCategoryName?: string;
  twoCategoryName?: string;
  threeCategoryName?: string;
  warehouseInventoryNum?: number;
  deliveryCycle?: string;
}
interface CjListV2Response {
  content: { productList: CjListV2Product[] }[];
  totalRecords: number;
  totalPages: number;
}

export interface CjSearchResult extends SupplierProductSummary {
  categoryPath?: string;
  deliveryCycleDays?: string;
  warehouseInventory?: number;
}

// ── Product detail (query) ─────────────────────────────────────────────
interface CjVariantInventory {
  countryCode: string;
  totalInventory: number;
}
interface CjVariant {
  vid: string;
  variantNameEn: string;
  variantSku: string;
  variantKey: string;
  variantSellPrice: number;
  inventories?: CjVariantInventory[];
}
interface CjProductDetail {
  pid: string;
  productNameEn: string;
  productSku: string;
  bigImage: string;
  productImageSet?: string[];
  productKeyEn?: string; // e.g. "Color-Size", positionally matches variantKey's "-"-joined parts
  description?: string;
  categoryName?: string;
  variants: CjVariant[];
}

function parseVariantOptions(productKeyEn: string | undefined, variantKey: string): Record<string, string> {
  const keys = (productKeyEn ?? "").split("-").filter(Boolean);
  const values = (variantKey ?? "").split("-").filter(Boolean);
  if (keys.length === 0 || keys.length !== values.length) {
    // Fall back to a single unlabeled option rather than guessing key names.
    return values.length > 0 ? { Option: values.join(" / ") } : {};
  }
  return Object.fromEntries(keys.map((k, i) => [k, values[i]!])) as Record<string, string>;
}

function toSupplierSummary(detail: CjProductDetail): SupplierProductSummary {
  return {
    supplierProductId: detail.pid,
    title: detail.productNameEn,
    images: detail.productImageSet && detail.productImageSet.length > 0 ? detail.productImageSet : [detail.bigImage],
    variants: (detail.variants ?? []).map((v) => ({
      supplierVariantId: v.vid,
      optionValues: parseVariantOptions(detail.productKeyEn, v.variantKey),
      // CJ's `variantSellPrice` is the price CJ charges to source this
      // item — treated here as our supplier cost, not a suggested resale
      // price. Verify this against an actual CJ invoice before trusting
      // it blindly for margin math on real money.
      supplierCostCents: Math.round(v.variantSellPrice * 100),
      inventoryQty: (v.inventories ?? []).reduce((sum, i) => sum + (i.totalInventory ?? 0), 0)
    }))
  };
}

// ── Freight calculation ────────────────────────────────────────────────
interface CjFreightOption {
  logisticAging: string;
  logisticPrice: number;
  logisticName: string;
}

// ── Order creation (V2) ────────────────────────────────────────────────
interface CjCreateOrderResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  interceptOrderReasons?: { code: number; message: string }[];
}

// ── Order status/tracking ──────────────────────────────────────────────
interface CjOrderDetail {
  orderId: string;
  orderStatus: string;
  subStatus: string | null;
  trackNumber: string | null;
  trackingProvider: string | null;
  trackingUrl?: string | null;
}

/**
 * How the store owner's CJ account pays CJ for an order (separate from
 * how the customer paid us — Section 13/14). Configurable since it's a
 * real business/account decision, not an API contract detail:
 *   1 = page payment (redirects to a CJ-hosted payment page — NOT fully
 *       automatic, needs a human to complete it)
 *   2 = balance payment (fully automatic — requires the CJ account to
 *       carry sufficient balance)
 *   3 = create the order only, no payment attempted
 * Defaults to 2 (balance) since "automatic order fulfillment" was an
 * explicit requirement — this assumes the CJ account is funded.
 */
function cjOrderPayType(): string {
  return process.env.CJ_ORDER_PAY_TYPE ?? "2";
}

export const cjProvider: Supplier = {
  id: "cj",

  async searchProducts(query: string, page = 1): Promise<SupplierProductSummary[]> {
    const data = await cjGet<CjListV2Response>("/product/listV2", { keyWord: query, page, size: 20 });
    const products = data.content?.[0]?.productList ?? [];
    return products.map((p) => ({
      supplierProductId: p.id,
      title: p.nameEn,
      images: [p.bigImage],
      // Search results are lightweight (no per-variant cost/inventory in
      // CJ's list response) — call getProduct(id) for the full variant
      // breakdown before importing, which is exactly the "preview before
      // import" step the admin UI walks through.
      variants: []
    }));
  },

  async getProduct(supplierProductId: string): Promise<SupplierProductSummary | null> {
    try {
      const detail = await cjGet<CjProductDetail>("/product/query", { pid: supplierProductId });
      return toSupplierSummary(detail);
    } catch {
      return null;
    }
  },

  async getInventory(_supplierVariantId: string) {
    throw new CjNotConfiguredError("getInventory");
  },

  async getInventoryBulk(supplierVariantIds: string[]) {
    // No dedicated bulk-by-variant-id endpoint has been confirmed yet —
    // falls back to re-fetching each variant's parent product detail,
    // which does include current inventory per variant. Correct, not
    // maximally efficient; worth replacing with CJ's dedicated inventory
    // endpoint once its contract is confirmed.
    const result: Record<string, number> = {};
    const uniqueIds = [...new Set(supplierVariantIds)];
    for (const vid of uniqueIds) {
      try {
        const detail = await cjGet<CjProductDetail>("/product/query", { variantSku: vid });
        const variant = detail.variants?.find((v) => v.vid === vid);
        if (variant) {
          result[vid] = (variant.inventories ?? []).reduce((sum, i) => sum + (i.totalInventory ?? 0), 0);
        }
      } catch {
        // Leave this one out of the result rather than failing the whole
        // batch — the caller (sync cron) treats a missing entry as "no
        // update this run," not as zero stock.
      }
    }
    return result;
  },

  async checkDestinationAvailability(
    supplierProductId: string,
    countryCode: string
  ): Promise<DestinationAvailability> {
    const detail = await cjGet<CjProductDetail>("/product/query", { pid: supplierProductId });
    const firstVariant = detail.variants?.[0];
    if (!firstVariant) return { isAvailable: false };

    // Freight calculation needs a real origin warehouse — use the first
    // country CJ actually reports stock in for this variant, since that's
    // the only shipping origin guaranteed to be valid (never guessed).
    const originCountry = firstVariant.inventories?.find((i) => i.totalInventory > 0)?.countryCode;
    if (!originCountry) return { isAvailable: false };

    try {
      const options = await cjPost<CjFreightOption[]>("/logistic/freightCalculate", {
        startCountryCode: originCountry,
        endCountryCode: countryCode,
        products: [{ vid: firstVariant.vid, quantity: 1 }]
      });

      if (!options || options.length === 0) return { isAvailable: false };

      // Cheapest available option becomes "the" shipping method/cost we
      // quote — a real admin UI could let the customer choose among
      // options[], but the destination-availability sync only needs one.
      const cheapest = [...options].sort((a, b) => a.logisticPrice - b.logisticPrice)[0];
      if (!cheapest) return { isAvailable: false };
      const [minDays, maxDays] = (cheapest.logisticAging ?? "").split("-").map((s) => parseInt(s, 10));

      return {
        isAvailable: true,
        shippingCostCents: Math.round(cheapest.logisticPrice * 100),
        estDeliveryMinDays: Number.isFinite(minDays) ? minDays : undefined,
        estDeliveryMaxDays: Number.isFinite(maxDays) ? maxDays : Number.isFinite(minDays) ? minDays : undefined
      };
    } catch {
      return { isAvailable: false };
    }
  },

  async submitOrder(input: FulfillmentOrderInput): Promise<FulfillmentResult> {
    // logisticName is required by createOrderV2 — re-derive the same
    // cheapest option checkDestinationAvailability would have picked,
    // for the actual product/quantity/destination being fulfilled.
    // (Real multi-item orders may span several logistics quotes; this
    // submits one order using the first item's route, which matches
    // today's one-shipment-per-order checkout flow.)
    const firstItem = input.items[0];
    if (!firstItem) throw new Error("Cannot submit a CJ order with no items.");

    const detail = await cjGet<CjProductDetail>("/product/query", { variantSku: firstItem.supplierVariantId });
    const variant = detail.variants?.find((v) => v.vid === firstItem.supplierVariantId) ?? detail.variants?.[0];
    const originCountry = variant?.inventories?.find((i) => i.totalInventory > 0)?.countryCode ?? "CN";

    const freightOptions = await cjPost<CjFreightOption[]>("/logistic/freightCalculate", {
      startCountryCode: originCountry,
      endCountryCode: input.shippingAddress.countryCode,
      products: input.items.map((i) => ({ vid: i.supplierVariantId, quantity: i.quantity }))
    });
    const logisticName = freightOptions?.[0]?.logisticName;
    if (!logisticName) {
      throw new Error(
        `No CJ shipping method available for ${input.shippingAddress.countryCode} on order ${input.orderNumber}.`
      );
    }

    const response = await cjPost<CjCreateOrderResponse>("/shopping/order/createOrderV2", {
      orderNumber: input.orderNumber,
      shippingCountryCode: input.shippingAddress.countryCode,
      shippingCountry: input.shippingAddress.countryCode,
      shippingProvince: input.shippingAddress.state ?? "",
      shippingCity: input.shippingAddress.city,
      shippingAddress: input.shippingAddress.line1,
      shippingAddress2: input.shippingAddress.line2 ?? "",
      shippingCustomerName: input.shippingAddress.fullName,
      shippingPhone: input.shippingAddress.phone ?? "",
      shippingZip: input.shippingAddress.postalCode ?? "",
      logisticName,
      fromCountryCode: originCountry,
      payType: cjOrderPayType(),
      platform: "Api",
      orderFlow: 1,
      products: input.items.map((i) => ({
        vid: i.supplierVariantId,
        quantity: i.quantity,
        storeLineItemId: input.internalOrderId
      }))
    });

    if (response.interceptOrderReasons && response.interceptOrderReasons.length > 0) {
      throw new Error(
        `CJ intercepted order ${input.orderNumber}: ${response.interceptOrderReasons.map((r) => r.message).join("; ")}`
      );
    }

    return { supplierOrderId: response.orderId || response.orderNumber, status: response.orderStatus };
  },

  async cancelOrder(_supplierOrderId: string) {
    throw new CjNotConfiguredError("cancelOrder");
  },

  async getTrackingUpdates(supplierOrderId: string): Promise<TrackingUpdate[]> {
    const detail = await cjGet<CjOrderDetail>("/shopping/order/getOrderDetail", { orderId: supplierOrderId });
    if (!detail.trackNumber) return [];
    return [
      {
        status: detail.orderStatus,
        description: detail.subStatus ?? undefined,
        occurredAt: new Date().toISOString(),
        carrier: detail.trackingProvider ?? undefined,
        trackingNumber: detail.trackNumber
      }
    ];
  }
};

/** Exposed for the order-status sync job, which needs the raw status/sub-status, not just tracking. */
export async function getCjOrderDetail(supplierOrderId: string): Promise<CjOrderDetail> {
  return cjGet<CjOrderDetail>("/shopping/order/getOrderDetail", { orderId: supplierOrderId });
}
