"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertTaxRule, setTaxRuleActive } from "@/lib/services/admin-taxes";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

interface TaxRule {
  id: string;
  country_code: string;
  region: string | null;
  rate_percent: number;
  is_active: boolean;
}

export function TaxRuleManager({ initialRules }: { initialRules: TaxRule[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [countryCode, setCountryCode] = useState("");
  const [region, setRegion] = useState("");
  const [rate, setRate] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await upsertTaxRule({
              countryCode,
              region: region.trim() || null,
              ratePercent: Number(rate)
            });
            if (result.success) {
              setCountryCode("");
              setRegion("");
              setRate("");
              router.refresh();
            } else {
              setError(result.error ?? "Save failed.");
            }
          });
        }}
        className="grid grid-cols-3 gap-4 rounded-sm border border-ink-700 bg-ink-900 p-5"
      >
        <Field label="Country code (e.g. US)" name="countryCode" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} required />
        <Field label="Region/state (optional)" name="region" value={region} onChange={(e) => setRegion(e.target.value)} />
        <Field label="Rate %" name="rate" value={rate} onChange={(e) => setRate(e.target.value)} required />
        {error && <p className="col-span-3 text-sm text-signal-danger">{error}</p>}
        <Button type="submit" disabled={pending} className="col-span-3">
          {pending ? "Saving…" : "Save rule"}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-sm border border-ink-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900 text-xs uppercase tracking-wide text-bone-500">
            <tr>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800 text-bone-300">
            {initialRules.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">{r.country_code}</td>
                <td className="px-4 py-3">{r.region ?? "All"}</td>
                <td className="px-4 py-3">{r.rate_percent}%</td>
                <td className="px-4 py-3">{r.is_active ? "Active" : "Disabled"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => startTransition(async () => { await setTaxRuleActive(r.id, !r.is_active); router.refresh(); })}
                    className="text-xs text-brass-400 hover:underline"
                  >
                    {r.is_active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
            {initialRules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-bone-500">
                  No tax rules configured — checkout applies 0% tax anywhere with no rule.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
