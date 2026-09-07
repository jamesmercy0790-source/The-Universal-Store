"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { removeFromWishlist, moveWishlistItemToCart } from "@/lib/services/wishlist";
import { Button } from "@/components/ui/Button";

interface Props {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string;
  priceCents: number;
  currencyCode: string;
  isActive: boolean;
}

export function WishlistItemRow({ id, title, slug, imageUrl, priceCents, currencyCode, isActive }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-4 border-b border-ink-800 py-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-ink-800">
        {imageUrl && <Image src={imageUrl} alt={title} fill className="object-cover" />}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <Link href={`/products/${slug}`} className="text-sm text-bone-100 hover:text-brass-400">
          {title}
        </Link>
        <span className="text-xs text-bone-500">
          {(priceCents / 100).toFixed(2)} {currencyCode}
        </span>
        {!isActive && <span className="text-xs text-signal-warning">No longer available</span>}
        {error && <span className="text-xs text-signal-danger">{error}</span>}
      </div>

      <Button
        type="button"
        variant="secondary"
        disabled={pending || !isActive}
        onClick={() =>
          startTransition(async () => {
            const result = await moveWishlistItemToCart(id);
            if (!result.success) setError(result.error ?? "Couldn't move to cart.");
          })
        }
      >
        Move to Cart
      </Button>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => removeFromWishlist(id))}
        className="text-xs text-bone-500 hover:text-signal-danger"
      >
        Remove
      </button>
    </div>
  );
}
