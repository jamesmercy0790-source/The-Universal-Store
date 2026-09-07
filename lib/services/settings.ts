import { createServiceRoleClient } from "@/lib/supabase/server";

export interface ContactInfo {
  whatsappNumber: string | null; // digits only, no "+", e.g. "2349123100767" — ready for wa.me/<number>
  email: string | null;
  socialLinks: Partial<Record<"instagram" | "facebook" | "tiktok" | "twitter", string>>;
}

const DEFAULT_CONTACT_INFO: ContactInfo = {
  whatsappNumber: null,
  email: null,
  socialLinks: {}
};

/**
 * Reads business/content config from `settings` (public-read, admin-write
 * per RLS). Contact details are deliberately data-driven rather than
 * hard-coded in the Contact page component — an email address, social
 * links, or a second support channel can be added later purely by
 * updating this row, no page restructuring required.
 */
export async function getContactInfo(): Promise<ContactInfo> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("settings").select("value_json").eq("key", "contact_info").maybeSingle();

  if (!data) return DEFAULT_CONTACT_INFO;
  return { ...DEFAULT_CONTACT_INFO, ...(data.value_json as Partial<ContactInfo>) };
}
