import { listTaxRules } from "@/lib/services/admin-taxes";
import { TaxRuleManager } from "@/components/admin/TaxRuleManager";

export const dynamic = "force-dynamic";

export default async function AdminTaxesPage() {
  const rules = await listTaxRules();
  return (
    <div>
      <h1 className="mb-2 font-display text-2xl text-bone-100">Tax Rules</h1>
      <p className="mb-6 text-sm text-bone-500">
        Checkout calculates tax server-side from these rules — a country/region with no rule here is
        taxed at 0%, never an invented rate.
      </p>
      <TaxRuleManager initialRules={rules as any} />
    </div>
  );
}
