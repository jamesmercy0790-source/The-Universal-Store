import { cookies } from "next/headers";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { GUEST_COUNTRY_COOKIE } from "@/lib/constants";

export interface ShopperLocale {
  countryCode: string | null;
  currencyCode: string | null;
  isSignedIn: boolean;
}

/**
 * Single source of truth for "what country is this shopper in" — used by
 * the header badge, PDP destination-availability checks, and checkout.
 * Never guesses: returns null/null when nothing has been explicitly set,
 * rather than defaulting to a country the shopper didn't choose.
 */
export async function getShopperLocale(): Promise<ShopperLocale> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("country_code, currency_code")
      .eq("id", user.id)
      .maybeSingle();
    return {
      countryCode: profile?.country_code ?? null,
      currencyCode: profile?.currency_code ?? null,
      isSignedIn: true
    };
  }

  const cookieStore = await cookies();
  const countryCode = cookieStore.get(GUEST_COUNTRY_COOKIE)?.value ?? null;
  if (!countryCode) return { countryCode: null, currencyCode: null, isSignedIn: false };

  const service = createServiceRoleClient();
  const { data: country } = await service
    .from("countries")
    .select("currency_code")
    .eq("code", countryCode)
    .maybeSingle();

  return { countryCode, currencyCode: country?.currency_code ?? null, isSignedIn: false };
}
