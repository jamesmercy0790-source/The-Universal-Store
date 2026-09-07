"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function CouponForm({ appliedCode, error }: { appliedCode: string | null; error: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(appliedCode ?? "");

  return (
    <div className="mb-4 border-b border-ink-800 pb-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const params = new URLSearchParams(searchParams.toString());
          if (code.trim()) params.set("coupon", code.trim());
          else params.delete("coupon");
          router.push(`/checkout?${params.toString()}`);
        }}
        className="flex gap-2"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Coupon code"
          className="flex-1 rounded-sm border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-bone-100 outline-none focus:border-brass-500"
        />
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>
      {appliedCode && !error && <p className="mt-1 text-xs text-signal-success">"{appliedCode}" applied.</p>}
      {error && <p className="mt-1 text-xs text-signal-danger">{error}</p>}
    </div>
  );
}
