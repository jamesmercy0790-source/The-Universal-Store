"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  previewImportPrice,
  importCjProduct,
  type CjProductPreview
} from "@/lib/services/cj-import";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

interface Category {
  id: string;
  name: string;
}

interface Props {
  supplierProductId: string;
  preview: CjProductPreview;
  categories: Category[];
}

export function CjImportForm({ supplierProductId, preview, categories }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [title, setTitle] = useState(preview.detail.title);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ productId: string; productSlug: string } | null>(null);
  const [pricePreview, setPricePreview] = useState(preview.pricePreviewFirstVariant);

  const cheapestVariant = preview.detail.variants[0];

  function onCategoryChange(newCategoryId: string) {
    setCategoryId(newCategoryId);
    if (!cheapestVariant) return;
    startTransition(async () => {
      const result = await previewImportPrice(cheapestVariant.supplierCostCents, newCategoryId);
      setPricePreview(result);
    });
  }

  if (preview.alreadyImported) {
    return (
      <p className="rounded-sm border border-ink-700 bg-ink-900 p-6 text-sm text-bone-300">
        This CJ product has already been imported ({preview.existingProductSlug}).
      </p>
    );
  }

  if (success) {
    return (
      <div className="rounded-sm border border-signal-success/40 bg-signal-success/10 p-6 text-sm text-bone-100">
        <p>Imported as a draft product. Publish it from the product editor when it's ready.</p>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => router.push("/admin/cj")}>
          Back to search
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div>
        <div className="relative aspect-square overflow-hidden rounded-sm bg-ink-900">
          {preview.detail.images[0] && (
            <Image src={preview.detail.images[0]} alt={preview.detail.title} fill className="object-cover" />
          )}
        </div>
        <div className="mt-4 text-sm text-bone-400">
          <p className="text-xs uppercase tracking-wide text-bone-500">Variants ({preview.detail.variants.length})</p>
          <ul className="mt-2 flex flex-col gap-1">
            {preview.detail.variants.map((v) => (
              <li key={v.supplierVariantId} className="flex justify-between">
                <span>{Object.values(v.optionValues).join(" / ") || v.supplierVariantId}</span>
                <span>
                  cost {(v.supplierCostCents / 100).toFixed(2)} USD · stock {v.inventoryQty}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Field label="Storefront title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wide text-bone-500">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="rounded-sm border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-bone-100 outline-none focus:border-brass-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wide text-bone-500">Category</label>
          <select
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="rounded-sm border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-bone-100 outline-none focus:border-brass-500"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {pricePreview && (
          <div className="rounded-sm border border-ink-700 bg-ink-900 p-4 text-sm">
            <div className="flex justify-between text-bone-400">
              <span>Margin applied</span>
              <span>{pricePreview.marginPercent}%</span>
            </div>
            <div className="flex justify-between text-bone-400">
              <span>Total cost (cheapest variant)</span>
              <span>{(pricePreview.totalCostCents / 100).toFixed(2)} USD</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-ink-800 pt-2 text-bone-100">
              <span>Selling price</span>
              <span>{(pricePreview.sellingPriceCents / 100).toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between text-signal-success">
              <span>Gross profit</span>
              <span>{(pricePreview.grossProfitCents / 100).toFixed(2)} USD</span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-signal-danger">{error}</p>}

        <Button
          type="button"
          disabled={pending || !categoryId}
          onClick={() =>
            startTransition(async () => {
              const result = await importCjProduct({
                supplierProductId,
                categoryId,
                titleOverride: title,
                descriptionOverride: description
              });
              if (result.success && result.productId && result.productSlug) {
                setSuccess({ productId: result.productId, productSlug: result.productSlug });
              } else {
                setError(result.error ?? "Import failed.");
              }
            })
          }
        >
          {pending ? "Importing…" : "Import product"}
        </Button>
      </div>
    </div>
  );
}
