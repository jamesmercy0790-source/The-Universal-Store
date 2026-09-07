"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function listTaxRules() {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("tax_rules").select("*").order("country_code");
  return data ?? [];
}

export interface AdminActionResult {
  success: boolean;
  error?: string;
}

export async function upsertTaxRule(input: {
  countryCode: string;
  region?: string | null;
  ratePercent: number;
}): Promise<AdminActionResult> {
  await requireAdmin();
  if (input.ratePercent < 0 || input.ratePercent > 100) {
    return { success: false, error: "Rate must be between 0 and 100." };
  }
  const supabase = createServiceRoleClient();

  // No unique constraint covers (country_code, null region) reliably —
  // same NULL-handling issue as the seed data — so upsert by hand.
  const query = supabase.from("tax_rules").select("id").eq("country_code", input.countryCode.toUpperCase());
  const { data: existing } = input.region
    ? await query.eq("region", input.region).maybeSingle()
    : await query.is("region", null).maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("tax_rules")
      .update({ rate_percent: input.ratePercent, is_active: true })
      .eq("id", existing.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase.from("tax_rules").insert({
      country_code: input.countryCode.toUpperCase(),
      region: input.region ?? null,
      rate_percent: input.ratePercent,
      is_active: true
    });
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/admin/taxes");
  return { success: true };
}

export async function setTaxRuleActive(id: string, isActive: boolean): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("tax_rules").update({ is_active: isActive }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/taxes");
  return { success: true };
}
