"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCoupon, setCouponActive, deleteCoupon } from "@/lib/services/coupons";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  usage_limit: number | null;
  usage_count: number;
  min_order_amount_cents: number;
  is_active: boolean;
  ends_at: string | null;
}

export function CouponManager({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [usageLimit, setUsageLimit] = useState("");
  const [minOrder, setMinOrder] = useState("0");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await createCoupon({
              code,
              type,
              value: Number(value),
              usageLimit: usageLimit.trim() === "" ? null : Number(usageLimit),
              minOrderAmountCents: Math.round(Number(minOrder) * 100),
              endsAt: endsAt || null
            });
            if (result.success) {
              setCode("");
              router.refresh();
            } else {
              setError(result.error ?? "Couldn't create coupon.");
            }
          });
        }}
        className="grid grid-cols-2 gap-4 rounded-sm border border-ink-700 bg-ink-900 p-5 sm:grid-cols-3"
      >
        <Field label="Code" name="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wide text-bone-500">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "percent" | "fixed")}
            className="rounded-sm border border-ink-700 bg-ink-950 px-4 py-3 text-sm text-bone-100 outline-none focus:border-brass-500"
          >
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed amount off (USD)</option>
          </select>
        </div>
        <Field label="Value" name="value" value={value} onChange={(e) => setValue(e.target.value)} />
        <Field label="Usage limit (blank = unlimited)" name="usageLimit" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} />
        <Field label="Minimum order (USD)" name="minOrder" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
        <Field label="Expires (optional)" name="endsAt" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />

        {error && <p className="col-span-full text-sm text-signal-danger">{error}</p>}
        <Button type="submit" disabled={pending} className="col-span-full sm:col-span-1">
          {pending ? "Creating…" : "Create coupon"}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-sm border border-ink-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900 text-xs uppercase tracking-wide text-bone-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Min order</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800 text-bone-300">
            {initialCoupons.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 text-bone-100">{c.code}</td>
                <td className="px-4 py-3">{c.type === "percent" ? `${c.value}%` : `$${c.value}`}</td>
                <td className="px-4 py-3">${(c.min_order_amount_cents / 100).toFixed(2)}</td>
                <td className="px-4 py-3">
                  {c.usage_count} / {c.usage_limit ?? "∞"}
                </td>
                <td className="px-4 py-3">{c.ends_at ? new Date(c.ends_at).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3">{c.is_active ? "Active" : "Disabled"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => startTransition(async () => { await setCouponActive(c.id, !c.is_active); router.refresh(); })}
                      className="text-brass-400 hover:underline"
                    >
                      {c.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(async () => { await deleteCoupon(c.id); router.refresh(); })}
                      className="text-signal-danger hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {initialCoupons.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-bone-500">
                  No coupons yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
