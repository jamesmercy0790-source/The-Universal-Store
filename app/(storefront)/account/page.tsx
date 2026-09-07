import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/services/auth-actions";
import { Button } from "@/components/ui/Button";

/**
 * Minimal protected overview — confirms the auth flow works end to end.
 * The full account dashboard (recent orders, wishlist count, addresses,
 * order history) is Section 8 work, built once orders/wishlist exist.
 */
export default async function AccountOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/account/login?redirect=/account");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, country_code, currency_code")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Your account</span>
      <h1 className="font-display text-3xl text-bone-100">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
      </h1>
      <p className="text-sm text-bone-500">
        {profile?.country_code
          ? `Shopping from ${profile.country_code} in ${profile.currency_code}.`
          : "You haven't set a shopping country yet."}
      </p>
      {!profile?.country_code && (
        <a href="/onboarding/country" className="text-sm text-brass-400 hover:text-brass-300">
          Set your country →
        </a>
      )}
      <a href="/account/orders" className="text-sm text-brass-400 hover:text-brass-300">
        View your orders →
      </a>
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </main>
  );
}
