import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { completeCountryOnboarding } from "@/lib/services/profile";
import { CountrySelectForm } from "@/components/storefront/CountrySelectForm";

export const metadata: Metadata = { title: "Where are you shopping from?" };

export default async function CountryOnboardingPage() {
  const supabase = createServiceRoleClient();
  const { data: countries } = await supabase
    .from("countries")
    .select("code, name, currency_code")
    .eq("supported", true)
    .order("name");

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div>
        <span className="text-xs uppercase tracking-[0.3em] text-brass-400">One last step</span>
        <h1 className="mt-2 font-display text-3xl text-bone-100">Where are you shopping from?</h1>
        <p className="mt-2 max-w-sm text-sm text-bone-500">
          We'll show pricing, shipping, and delivery estimates for your country. You can
          change this any time from Account → Preferences.
        </p>
      </div>
      <CountrySelectForm countries={countries ?? []} action={completeCountryOnboarding} />
    </main>
  );
}
