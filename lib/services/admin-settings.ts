"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ContactInfo } from "@/lib/services/settings";

export async function updateContactInfo(input: ContactInfo): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "contact_info", value_json: input }, { onConflict: "key" });
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/settings");
  revalidatePath("/contact");
  return { success: true };
}

export interface IntegrationStatus {
  name: string;
  configured: boolean;
}

/**
 * Reports only whether each server-only credential is *present* —
 * never its value, and never sent to a client component that isn't
 * this one already-server-rendered page (Section: "never display
 * secret keys after they have been saved").
 */
export async function getIntegrationStatuses(): Promise<IntegrationStatus[]> {
  await requireAdmin();
  return [
    { name: "Supabase", configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) },
    { name: "CJdropshipping", configured: Boolean(process.env.CJ_API_KEY) },
    { name: "Paystack", configured: Boolean(process.env.PAYSTACK_SECRET_KEY) },
    { name: "Flutterwave", configured: Boolean(process.env.FLUTTERWAVE_SECRET_KEY) },
    { name: "Resend (email)", configured: Boolean(process.env.RESEND_API_KEY) },
    { name: "Exchange rate provider", configured: Boolean(process.env.EXCHANGE_RATE_API_KEY) },
    { name: "Cron authentication", configured: Boolean(process.env.CRON_SECRET) }
  ];
}
