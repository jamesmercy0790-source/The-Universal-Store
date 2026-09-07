"use client";

import { useState } from "react";
import { AddToCartButton } from "@/components/storefront/AddToCartButton";
import { AddToWishlistButton } from "@/components/storefront/AddToWishlistButton";

interface Variant {
  id: string;
  sku: string;
  option_values_json: Record<string, string>;
  is_active: boolean;
  inventory_qty: number;
}

interface Props {
  productId: string;
  variants: Variant[];
  destinationConfirmedAvailable: boolean | null; // null = no country selected yet
}

function describeVariant(v: Variant) {
  const values = Object.values(v.option_values_json ?? {});
  return values.length > 0 ? values.join(" / ") : v.sku;
}

export function ProductOptions({ productId, variants, destinationConfirmedAvailable }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(variants[0]?.id ?? null);
  const [quantity, setQuantity] = useState(1);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
  const outOfStock = selectedVariant ? selectedVariant.inventory_qty < 1 || !selectedVariant.is_active : false;

  let disabledReason: string | undefined;
  let disabled = false;

  if (destinationConfirmedAvailable === null) {
    disabled = true;
    disabledReason = "Select your country to see shipping availability.";
  } else if (destinationConfirmedAvailable === false) {
    disabled = true;
    disabledReason = "This product currently can't be shipped to your selected country.";
  } else if (outOfStock) {
    disabled = true;
    disabledReason = "This option is currently out of stock.";
  }

  return (
    <div className="flex flex-col gap-4">
      {variants.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="variant" className="text-xs uppercase tracking-wide text-bone-500">
            Options
          </label>
          <select
            id="variant"
            value={selectedVariantId ?? ""}
            onChange={(e) => setSelectedVariantId(e.target.value)}
            className="rounded-sm border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-bone-100 outline-none focus:border-brass-500"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={!v.is_active || v.inventory_qty < 1}>
                {describeVariant(v)} {v.inventory_qty < 1 ? "(out of stock)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label htmlFor="quantity" className="text-xs uppercase tracking-wide text-bone-500">
          Qty
        </label>
        <input
          id="quantity"
          type="number"
          min={1}
          max={selectedVariant?.inventory_qty ?? 99}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          className="w-20 rounded-sm border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-bone-100 outline-none focus:border-brass-500"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <AddToCartButton
          productId={productId}
          variantId={selectedVariant?.id}
          quantity={quantity}
          disabled={disabled}
          disabledReason={disabledReason}
        />
        <AddToWishlistButton productId={productId} />
      </div>
    </div>
  );
}
