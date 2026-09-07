"use client";

import Image from "next/image";
import Link from "next/link";
import { useTransition } from "react";
import { updateCartItemQuantity, removeCartItem } from "@/lib/services/cart";

interface Props {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string;
  quantity: number;
  priceCents: number;
  currencyCode: string;
}

export function CartItemRow({ id, title, slug, imageUrl, quantity, priceCents, currencyCode }: Props) {
  const [pending, startTransition] = useTransition();

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
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          aria-label="Decrease quantity"
          onClick={() => startTransition(() => updateCartItemQuantity(id, quantity - 1))}
          className="h-7 w-7 rounded-sm border border-ink-700 text-bone-300 hover:border-brass-500"
        >
          −
        </button>
        <span className="w-6 text-center text-sm text-bone-100">{quantity}</span>
        <button
          type="button"
          disabled={pending}
          aria-label="Increase quantity"
          onClick={() => startTransition(() => updateCartItemQuantity(id, quantity + 1))}
          className="h-7 w-7 rounded-sm border border-ink-700 text-bone-300 hover:border-brass-500"
        >
          +
        </button>
      </div>

      <span className="w-20 text-right text-sm text-bone-100">
        {((priceCents * quantity) / 100).toFixed(2)} {currencyCode}
      </span>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => removeCartItem(id))}
        className="text-xs text-bone-500 hover:text-signal-danger"
      >
        Remove
      </button>
    </div>
  );
}
