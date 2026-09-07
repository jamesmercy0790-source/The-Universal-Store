import { getContactInfo } from "@/lib/services/settings";
import { getIntegrationStatuses } from "@/lib/services/admin-settings";
import { ContactInfoForm } from "@/components/admin/ContactInfoForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const contactInfo = await getContactInfo();
  const integrations = await getIntegrationStatuses();

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="mb-6 font-display text-2xl text-bone-100">Settings</h1>

        <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">General — Contact</h2>
        <ContactInfoForm initial={{ whatsappNumber: contactInfo.whatsappNumber, email: contactInfo.email }} />
      </div>

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Currency</h2>
        <p className="rounded-sm border border-ink-700 bg-ink-900 p-5 text-sm text-bone-300">
          Base currency: <strong className="text-bone-100">USD</strong>. Supported display currencies:{" "}
          <strong className="text-bone-100">NGN, USD, EUR</strong>. These are set in code
          (<code className="text-xs">lib/payments/types.ts</code>,{" "}
          <code className="text-xs">lib/currency/service.ts</code>) rather than here, since adding a
          currency also requires a payment provider that actually supports it — not just a config
          flag.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Pricing</h2>
        <p className="rounded-sm border border-ink-700 bg-ink-900 p-5 text-sm text-bone-300">
          Global default margin and category overrides are managed on the{" "}
          <a href="/admin/pricing" className="text-brass-400 hover:text-brass-300">Pricing</a> page.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Integrations</h2>
        <div className="overflow-hidden rounded-sm border border-ink-700">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-ink-800">
              {integrations.map((i) => (
                <tr key={i.name} className="text-bone-300">
                  <td className="px-4 py-3">{i.name}</td>
                  <td className={`px-4 py-3 text-right ${i.configured ? "text-signal-success" : "text-signal-warning"}`}>
                    {i.configured ? "Configured" : "Not configured"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-bone-600">
          This only shows whether each credential is present as a server environment variable —
          actual key values are never displayed here or anywhere else, before or after saving.
        </p>
      </div>
    </div>
  );
}
