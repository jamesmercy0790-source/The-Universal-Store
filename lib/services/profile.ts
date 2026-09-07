"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/services/activity";
import { GUEST_COUNTRY_COOKIE } from "@/lib/constants";

/**
 * Sets the shopper's country/currency preference. Logged-in users get it
 * written to their profile row (Account → Preferences → Country &
 * Currency, Section 4); guests get a cookie that the storefront reads
 * until they create an account. Both paths funnel through this one
 * function so the two never drift out of sync in behavior.
 */
export async function setCountryPreference(countryCode: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const service = createServiceRoleClient();
  const { data: country } = await service
    .from("countries")
    .select("code, currency_code, supported")
    .eq("code", countryCode)
    .maybeSingle();

  if (!country || !country.supported) {
    throw new Error(`${countryCode} is not currently a supported destination.`);
  }

  if (user) {
    await supabase
      .from("profiles")
      .update({ country_code: country.code, currency_code: country.currency_code })
      .eq("id", user.id);

    await logActivity({
      actorType: "customer",
      actorId: user.id,
      eventType: "user.country_set",
      metadata: { country: country.code, currency: country.currency_code }
    });
  } else {
    const cookieStore = await cookies();
    cookieStore.set(GUEST_COUNTRY_COOKIE, country.code, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax"
    });
  }
}

/** Used by the post-signup onboarding page — sets the preference, then continues. */
export async function completeCountryOnboarding(formData: FormData): Promise<void> {
  const countryCode = String(formData.get("countryCode") ?? "");
  await setCountryPreference(countryCode);
  redirect("/account");
}
