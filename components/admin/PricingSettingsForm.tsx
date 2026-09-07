"use client";

import { useState, useTransition } from "react";
import { updateGlobalMargin, updateCategoryMargin, type CategoryMarginRow } from "@/lib/services/admin-pricing";
import { Button } from "@/components/ui/Button";

export function PricingSettingsForm({
  initialGlobalDefault,
  initialCategories
}: {
  initialGlobalDefault: number;
  initialCategories: CategoryMarginRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [globalDefault, setGlobalDefault] = useState(initialGlobalDefault.toString());
  const [categories, setCategories] = useState(
    initialCategories.map((c) => ({ ...c, draft: c.marginOverridePercent?.toString() ?? "" }))
  );
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-sm border border-ink-700 bg-ink-900 p-5">
        <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Global default margin</h2>
        <p className="mb-3 text-xs text-bone-500">Applies to any product with no category or product-specific override.</p>
        <div className="flex items-center gap-3">
          <input
            value={globalDefault}
            onChange={(e) => setGlobalDefault(e.target.value)}
            className="w-24 rounded-sm border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-bone-100 outline-none focus:border-brass-500"
          />
          <span className="text-sm text-bone-500">%</span>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateGlobalMargin(Number(globalDefault));
                setMessage(result.success ? "Global margin saved." : result.error ?? "Save failed.");
              })
            }
          >
            Save
          </Button>
        </div>
      </div>

      <div className="rounded-sm border border-ink-700 bg-ink-900 p-5">
        <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Category overrides</h2>
        <p className="mb-3 text-xs text-bone-500">Leave blank to fall back to the global default.</p>
        <div className="flex flex-col divide-y divide-ink-800">
          {categories.map((c, i) => (
            <div key={c.id} className="flex items-center justify-between py-3">
              <span className="text-sm text-bone-300">{c.name}</span>
              <div className="flex items-center gap-3">
                <input
                  value={c.draft}
                  placeholder={`${initialGlobalDefault}%`}
                  onChange={(e) => {
                    const next = [...categories];
                    next[i] = { ...c, draft: e.target.value };
                    setCategories(next);
                  }}
                  className="w-20 rounded-sm border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-bone-100 outline-none focus:border-brass-500"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const percent = c.draft.trim() === "" ? null : Number(c.draft);
                      const result = await updateCategoryMargin(c.id, percent);
                      setMessage(result.success ? `${c.name} margin saved.` : result.error ?? "Save failed.");
                    })
                  }
                >
                  Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {message && <p className="text-xs text-bone-500">{message}</p>}
    </div>
  );
}
