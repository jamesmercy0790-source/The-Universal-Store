"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getGlobalDefaultMarginPercent, setGlobalDefaultMarginPercent } from "@/lib/services/margin-pricing";
import { logActivity } from "@/lib/services/activity";

export interface CategoryMarginRow {
  id: string;
  name: string;
  marginOverridePercent: number | null;
}

export async function getPricingOverview(): Promise<{ globalDefault: number; categories: CategoryMarginRow[] }> {
  await requireAdmin();
  const globalDefault = await getGlobalDefaultMarginPercent();

  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("categories").select("id, name, margin_override_percent").order("sort_order");

  return {
    globalDefault,
    categories: (data ?? []).map((c) => ({ id: c.id, name: c.name, marginOverridePercent: c.margin_override_percent }))
  };
}

export interface AdminActionResult {
  success: boolean;
  error?: string;
}

export async function updateGlobalMargin(percent: number): Promise<AdminActionResult> {
  const { user } = await requireAdmin();
  if (percent < 0 || percent >= 100) return { success: false, error: "Margin must be between 0 and 100." };

  await setGlobalDefaultMarginPercent(percent);
  await logActivity({ actorType: "admin", actorId: user.id, eventType: "admin.global_margin_changed", metadata: { percent } });
  revalidatePath("/admin/pricing");
  return { success: true };
}

export async function updateCategoryMargin(categoryId: string, percent: number | null): Promise<AdminActionResult> {
  const { user } = await requireAdmin();
  if (percent != null && (percent < 0 || percent >= 100)) {
    return { success: false, error: "Margin must be between 0 and 100." };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("categories").update({ margin_override_percent: percent }).eq("id", categoryId);
  if (error) return { success: false, error: error.message };

  await logActivity({
    actorType: "admin",
    actorId: user.id,
    eventType: "admin.category_margin_changed",
    entityType: "category",
    entityId: categoryId,
    metadata: { percent }
  });
  revalidatePath("/admin/pricing");
  return { success: true };
}
