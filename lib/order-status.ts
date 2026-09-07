/**
 * Mirrors the Postgres enums in supabase/migrations/0001_init_schema.sql
 * exactly (payment_status, fulfillment_status, shipping_status). Kept as
 * plain string-literal unions here (not generated from the DB) since the
 * project doesn't run `supabase gen types` yet — see HANDOFF.md §9. If
 * these ever drift from the actual enum values, the DB will reject writes
 * loudly (invalid enum value), so a mismatch fails safely rather than
 * silently.
 */
export type PaymentStatus = "pending" | "paid" | "failed" | "refund_pending" | "refunded";
export type FulfillmentStatus =
  | "unfulfilled"
  | "submitted_to_supplier"
  | "supplier_confirmed"
  | "fulfilling"
  | "failed";
export type ShippingStatus = "pending" | "shipped" | "in_transit" | "out_for_delivery" | "delivered" | "cancelled";
