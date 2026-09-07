"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  couponId?: string;
  discountCents?: number;
}

/**
 * The only place a coupon's discount is computed. Called from checkout
 * with the server-derived subtotal (never a client-submitted total) — a
 * coupon can only ever reduce a total the server itself calculated.
 */
export async function validateCoupon(code: string, subtotalCents: number): Promise<CouponValidationResult> {
  if (!code.trim()) return { valid: false, error: "Enter a coupon code." };

  const supabase = createServiceRoleClient();
  const { data: coupon } = await supabase
    .from("coupons")
    .select("id, code, type, value, starts_at, ends_at, usage_limit, usage_count, min_order_amount_cents, is_active")
    .ilike("code", code.trim())
    .maybeSingle();

  if (!coupon || !coupon.is_active) return { valid: false, error: "This coupon code isn't valid." };

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return { valid: false, error: "This coupon isn't active yet." };
  }
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) {
    return { valid: false, error: "This coupon has expired." };
  }
  if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
    return { valid: false, error: "This coupon has reached its usage limit." };
  }
  if (subtotalCents < coupon.min_order_amount_cents) {
    return {
      valid: false,
      error: `This coupon requires a minimum order of ${(coupon.min_order_amount_cents / 100).toFixed(2)} USD.`
    };
  }

  const discountCents =
    coupon.type === "percent"
      ? Math.round(subtotalCents * (Number(coupon.value) / 100))
      : Math.round(Number(coupon.value) * 100);

  return { valid: true, couponId: coupon.id, discountCents: Math.min(discountCents, subtotalCents) };
}

/** Called once an order is actually created with this coupon — never speculatively. */
export async function incrementCouponUsage(couponId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: coupon } = await supabase.from("coupons").select("usage_count").eq("id", couponId).maybeSingle();
  if (coupon) {
    await supabase.from("coupons").update({ usage_count: coupon.usage_count + 1 }).eq("id", couponId);
  }
}

// ── Admin CRUD ───────────────────────────────────────────────────────

export async function listCoupons() {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("coupons").select("*").order("id", { ascending: false });
  return data ?? [];
}

export interface CouponInput {
  code: string;
  type: "percent" | "fixed";
  value: number;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  minOrderAmountCents?: number;
}

export interface AdminActionResult {
  success: boolean;
  error?: string;
}

export async function createCoupon(input: CouponInput): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("coupons").insert({
    code: input.code.trim().toUpperCase(),
    type: input.type,
    value: input.value,
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    usage_limit: input.usageLimit ?? null,
    min_order_amount_cents: input.minOrderAmountCents ?? 0,
    is_active: true
  });
  if (error) return { success: false, error: error.message.includes("duplicate") ? "That code already exists." : error.message };
  return { success: true };
}

export async function setCouponActive(couponId: string, isActive: boolean): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("coupons").update({ is_active: isActive }).eq("id", couponId);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function deleteCoupon(couponId: string): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("coupons").delete().eq("id", couponId);
  return error ? { success: false, error: error.message } : { success: true };
}
