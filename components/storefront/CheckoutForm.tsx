"use client";

import { useState, useTransition } from "react";
import { placeOrder, type ShippingAddressInput } from "@/lib/services/checkout";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function CheckoutForm({ couponCode }: { couponCode?: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Stable for the lifetime of this page load — a double-click, a slow
  // retry, or resubmitting after an error all reuse the same key, so the
  // server treats them as the same attempt rather than separate orders.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const form = new FormData(e.currentTarget);
        const address: ShippingAddressInput = {
          fullName: String(form.get("fullName") ?? ""),
          phone: String(form.get("phone") ?? "") || undefined,
          line1: String(form.get("line1") ?? ""),
          line2: String(form.get("line2") ?? "") || undefined,
          city: String(form.get("city") ?? ""),
          state: String(form.get("state") ?? "") || undefined,
          postalCode: String(form.get("postalCode") ?? "") || undefined
        };

        startTransition(async () => {
          const result = await placeOrder(address, idempotencyKey, couponCode);
          // placeOrder redirects to the payment provider (or to an
          // existing order's status page) on success — a returned value
          // only ever happens on the error path.
          if (result && !result.success) {
            setError(result.error);
          }
        });
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Full name" name="fullName" required autoComplete="name" />
      <Field label="Phone" name="phone" type="tel" autoComplete="tel" />
      <Field label="Address line 1" name="line1" required autoComplete="address-line1" />
      <Field label="Address line 2" name="line2" autoComplete="address-line2" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="City" name="city" required autoComplete="address-level2" />
        <Field label="State / Province" name="state" autoComplete="address-level1" />
      </div>
      <Field label="Postal code" name="postalCode" autoComplete="postal-code" />

      {error && (
        <p className="rounded-sm border border-signal-danger/40 bg-signal-danger/10 px-4 py-3 text-sm text-signal-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Redirecting to payment…" : "Continue to Payment"}
      </Button>
    </form>
  );
}
