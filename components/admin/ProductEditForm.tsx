"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProduct, previewProductPrice, setVariantActive } from "@/lib/services/admin-products";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

interface Category {
  id: string;
  name: string;
}
interface Variant {
  id: string;
  sku: string;
  supplier_variant_id: string | null;
  option_values_json: Record<string, string>;
  inventory_qty: number;
  is_active: boolean;
}

interface Props {
  productId: string;
  initialTitle: string;
  initialDescription: string;
  initialCategoryId: string;
  initialSellingPriceCents: number;
  initialMarginOverride: number | null;
  initialIsFeatured: boolean;
  supplierCostCents: number;
  supplierShippingCostCents: number;
  effectiveMarginPercent: number;
  categories: Category[];
  variants: Variant[];
}

export function ProductEditForm({
  productId,
  initialTitle,
  initialDescription,
  initialCategoryId,
  initialSellingPriceCents,
  initialMarginOverride,
  initialIsFeatured,
  supplierCostCents,
  supplierShippingCostCents,
  effectiveMarginPercent,
  categories,
  variants
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [sellingPrice, setSellingPrice] = useState((initialSellingPriceCents / 100).toFixed(2));
  const [marginOverride, setMarginOverride] = useState(initialMarginOverride?.toString() ?? "");
  const [isFeatured, setIsFeatured] = useState(initialIsFeatured);
  const [previewMargin, setPreviewMargin] = useState(effectiveMarginPercent);
  const [message, setMessage] = useState<string | null>(null);

  const totalCost = supplierCostCents + supplierShippingCostCents;

  function recalculate() {
    startTransition(async () => {
      const override = marginOverride.trim() === "" ? null : Number(marginOverride);
      const result = await previewProductPrice(supplierCostCents, supplierShippingCostCents, override, categoryId);
      setSellingPrice((result.sellingPriceCents / 100).toFixed(2));
      setPreviewMargin(result.marginPercent);
    });
  }

  function save() {
    startTransition(async () => {
      const result = await updateProduct(productId, {
        title,
        description,
        categoryId,
        sellingPriceCents: Math.round(Number(sellingPrice) * 100),
        marginOverridePercent: marginOverride.trim() === "" ? null : Number(marginOverride),
        isFeatured
      });
      setMessage(result.success ? "Saved." : result.error ?? "Save failed.");
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Field label="Title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wide text-bone-500">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="rounded-sm border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-bone-100 outline-none focus:border-brass-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wide text-bone-500">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-sm border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-bone-100 outline-none focus:border-brass-500"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-bone-300">
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
          Featured on homepage
        </label>

        <div className="mt-4">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Variants ({variants.length})</h2>
          <div className="flex flex-col divide-y divide-ink-800 rounded-sm border border-ink-700">
            {variants.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-bone-300">
                  {Object.values(v.option_values_json ?? {}).join(" / ") || v.sku} · stock {v.inventory_qty}
                </span>
                <button
                  type="button"
                  onClick={() => startTransition(() => {void setVariantActive(v.id, !v.is_active) })}
                  className={v.is_active ? "text-signal-success text-xs hover:underline" : "text-bone-600 text-xs hover:underline"}
                >
                  {v.is_active ? "Visible — click to hide" : "Hidden — click to show"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-ink-700 bg-ink-900 p-5">
        <h2 className="mb-4 text-xs uppercase tracking-wide text-bone-500">Pricing</h2>
        <dl className="flex flex-col gap-2 text-sm text-bone-400">
          <div className="flex justify-between">
            <dt>Supplier cost</dt>
            <dd>{(supplierCostCents / 100).toFixed(2)} USD</dd>
          </div>
          <div className="flex justify-between">
            <dt>Supplier shipping</dt>
            <dd>{(supplierShippingCostCents / 100).toFixed(2)} USD</dd>
          </div>
          <div className="flex justify-between border-t border-ink-800 pt-2 text-bone-300">
            <dt>Total cost</dt>
            <dd>{(totalCost / 100).toFixed(2)} USD</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wide text-bone-500">
            Margin override % (blank = use category/global default)
          </label>
          <input
            value={marginOverride}
            onChange={(e) => setMarginOverride(e.target.value)}
            placeholder={`currently ${previewMargin}%`}
            className="rounded-sm border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-bone-100 outline-none focus:border-brass-500"
          />
          <Button type="button" variant="secondary" disabled={pending} onClick={recalculate} className="mt-1">
            Recalculate price from margin
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wide text-bone-500">Selling price (USD)</label>
          <input
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            className="rounded-sm border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-bone-100 outline-none focus:border-brass-500"
          />
        </div>

        <div className="mt-3 flex justify-between text-sm text-signal-success">
          <span>Est. gross profit</span>
          <span>{(Math.round(Number(sellingPrice) * 100) / 100 - totalCost / 100).toFixed(2)} USD</span>
        </div>

        {message && <p className="mt-3 text-xs text-bone-500">{message}</p>}

        <Button type="button" disabled={pending} onClick={save} className="mt-4 w-full">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
