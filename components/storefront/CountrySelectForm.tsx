"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";

export interface CountryOption {
  code: string;
  name: string;
  currency_code: string;
}

interface Props {
  countries: CountryOption[];
  action: (formData: FormData) => Promise<void>;
  defaultCountry?: string;
  submitLabel?: string;
}

export function CountrySelectForm({ countries, action, defaultCountry, submitLabel = "Continue" }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => action(formData))}
      className="mx-auto flex w-full max-w-sm flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5 text-left">
        <label htmlFor="countryCode" className="text-xs uppercase tracking-wide text-bone-500">
          Country
        </label>
        <select
          id="countryCode"
          name="countryCode"
          defaultValue={defaultCountry}
          required
          className="rounded-sm border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-bone-100 outline-none focus:border-brass-500"
        >
          <option value="" disabled>
            Select your country
          </option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} — {c.currency_code}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
