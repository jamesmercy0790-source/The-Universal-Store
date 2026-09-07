"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToWishlist } from "@/lib/services/wishlist";
import { Button } from "@/components/ui/Button";

export function AddToWishlistButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await addToWishlist(productId);
            if (result.success) {
              setMessage("Saved to wishlist ✓");
              return;
            }
            if (result.requiresAuth) {
              router.push(`/account/login?redirect=${encodeURIComponent(window.location.pathname)}`);
              return;
            }
            setMessage(result.error ?? "Couldn't save to wishlist.");
          })
        }
      >
        {pending ? "Saving…" : "Add to Wishlist"}
      </Button>
      {message && <p className="text-xs text-bone-500">{message}</p>}
    </div>
  );
}
