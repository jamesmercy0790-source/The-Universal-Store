import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Looks up a configured tax rate for a destination from `tax_rules`
 * (Section: "configurable/extensible, not hard-coded worldwide rates").
 * No matching row means no tax is applied — an explicit, honest default
 * rather than guessing a rate, until you configure one for that
 * destination. Swappable for a dedicated tax API later without changing
 * anything that calls this function.
 */
export async function getTaxRatePercent(countryCode: string, region?: string | null): Promise<number> {
  const supabase = createServiceRoleClient();

  if (region) {
    const { data: regional } = await supabase
      .from("tax_rules")
      .select("rate_percent")
      .eq("country_code", countryCode)
      .eq("region", region)
      .eq("is_active", true)
      .maybeSingle();
    if (regional) return Number(regional.rate_percent);
  }

  const { data: countryLevel } = await supabase
    .from("tax_rules")
    .select("rate_percent")
    .eq("country_code", countryCode)
    .is("region", null)
    .eq("is_active", true)
    .maybeSingle();

  return countryLevel ? Number(countryLevel.rate_percent) : 0;
}

export function calculateTaxCents(taxableCents: number, ratePercent: number): number {
  return Math.round(taxableCents * (ratePercent / 100));
}
