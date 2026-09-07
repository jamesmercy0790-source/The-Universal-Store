import { notFound } from "next/navigation";
import Image from "next/image";
import { getAdminProduct } from "@/lib/services/admin-products";
import { listCategories } from "@/lib/services/catalog";
import { ProductEditForm } from "@/components/admin/ProductEditForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminProductEditPage({ params }: Props) {
  const { id } = await params;

  const result = await getAdminProduct(id);
  if (!result) notFound();
  const { product, marginPercent, totalCostCents, grossProfitCents } = result;

  const categories = await listCategories();
  const images = [...(product.product_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-bone-100">{product.title}</h1>
        <span className="text-xs text-bone-500">
          {product.supplier_product_id ? `CJ: ${product.supplier_product_id}` : "Manually created"}
        </span>
      </div>

      {images.length > 0 && (
        <div className="mb-6 flex gap-2">
          {images.slice(0, 6).map((img: any) => (
            <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded-sm bg-ink-900">
              <Image src={img.url} alt={img.alt_text ?? product.title} fill className="object-cover" />
            </div>
          ))}
        </div>
      )}

      <ProductEditForm
        productId={product.id}
        initialTitle={product.title}
        initialDescription={product.description ?? ""}
        initialCategoryId={product.category_id ?? categories[0]?.id ?? ""}
        initialSellingPriceCents={product.selling_price_cents}
        initialMarginOverride={product.margin_override_percent}
        initialIsFeatured={product.is_featured}
        supplierCostCents={product.base_cost_cents}
        supplierShippingCostCents={product.supplier_shipping_cost_cents}
        effectiveMarginPercent={marginPercent}
        categories={categories}
        variants={product.product_variants ?? []}
      />

      <p className="mt-6 text-xs text-bone-600">
        Current stored margin: {marginPercent}% · total cost {(totalCostCents / 100).toFixed(2)} USD · gross profit{" "}
        {(grossProfitCents / 100).toFixed(2)} USD at the current saved price.
      </p>
    </div>
  );
}
