import { getPricingOverview } from "@/lib/services/admin-pricing";
import { PricingSettingsForm } from "@/components/admin/PricingSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const { globalDefault, categories } = await getPricingOverview();

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl text-bone-100">Pricing</h1>
      <p className="mb-6 max-w-xl text-sm text-bone-500">
        True profit margin, not markup: selling price = total cost ÷ (1 − margin). Product-specific
        overrides (set per product on its edit page) always win over these, category overrides win
        over the global default.
      </p>
      <PricingSettingsForm initialGlobalDefault={globalDefault} initialCategories={categories} />
    </div>
  );
}
