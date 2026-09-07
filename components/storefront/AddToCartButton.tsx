"use client";

import { useState, useTransition } from "react";
import { addToCart } from "@/lib/services/cart";
import { Button } from "@/components/ui/Button";

interface Props {
  productId: string;
  variantId?: string | null;
  quantity?: number;
  disabled?: boolean;
  disabledReason?: string;
}

export function AddToCartButton({ productId, variantId, quantity = 1, disabled, disabledReason }: Props) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "added" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (disabled) {
    return (
      <div className="flex flex-col gap-1">
        <Button type="button" disabled variant="secondary">
          Unavailable
        </Button>
        {disabledReason && <p className="text-xs text-bone-500">{disabledReason}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await addToCart({ productId, variantId, quantity });
            if (result.success) {
              setStatus("added");
              setError(null);
            } else {
              setStatus("error");
              setError(result.error ?? "Couldn't add to cart.");
            }
          })
        }
      >
        {pending ? "Adding…" : status === "added" ? "Added ✓" : "Add to Cart"}
      </Button>
      {status === "error" && error && <p className="text-xs text-signal-danger">{error}</p>}
    </div>
  );
}
