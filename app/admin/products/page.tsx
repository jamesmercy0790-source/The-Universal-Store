import Link from "next/link";
import { listAdminProducts, type AdminProductListFilters } from "@/lib/services/admin-products";
import { ProductStatusActions } from "@/components/admin/ProductStatusActions";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string }>;
}

const STATUS_TABS = [
  { value: undefined, label: "All" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Published" },
  { value: "archived", label: "Archived" }
] as const;

export default async function AdminProductsPage({ searchParams }: Props) {
  const { q, status, sort, page } = await searchParams;

  const filters: AdminProductListFilters = {
    search: q,
    status: status as AdminProductListFilters["status"],
    sort: sort as AdminProductListFilters["sort"],
    page: page ? Number(page) : 1
  };

  const { products, total } = await listAdminProducts(filters);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-bone-100">Products ({total})</h1>
        <Link href="/admin/cj" className="text-sm text-brass-400 hover:text-brass-300">
          + Import from CJ
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-sm">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.label}
              href={tab.value ? `/admin/products?status=${tab.value}` : "/admin/products"}
              className={status === tab.value || (!status && !tab.value) ? "text-brass-400" : "text-bone-500 hover:text-bone-300"}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search products…"
            className="rounded-sm border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-bone-100 outline-none focus:border-brass-500"
          />
        </form>
      </div>

      <div className="overflow-x-auto rounded-sm border border-ink-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900 text-xs uppercase tracking-wide text-bone-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">CJ</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {products.map((p: any) => {
              const stock = (p.product_variants ?? []).reduce((sum: number, v: any) => sum + (v.inventory_qty ?? 0), 0);
              return (
                <tr key={p.id} className="text-bone-300">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="text-bone-100 hover:text-brass-400">
                      {p.title}
                    </Link>
                    {p.is_featured && <span className="ml-2 text-[10px] uppercase text-brass-400">Featured</span>}
                  </td>
                  <td className="px-4 py-3">{p.categories?.name ?? "—"}</td>
                  <td className="px-4 py-3">{((p.base_cost_cents + p.supplier_shipping_cost_cents) / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">{(p.selling_price_cents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">{stock}</td>
                  <td className="px-4 py-3">
                    {p.supplier_product_id ? (
                      <span className={p.supplier_sync_status === "ok" ? "text-signal-success" : "text-bone-500"}>
                        {p.supplier_sync_status ?? "linked"}
                      </span>
                    ) : (
                      <span className="text-bone-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{p.status}</td>
                  <td className="px-4 py-3">
                    <ProductStatusActions productId={p.id} status={p.status} />
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-bone-500">
                  No products match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
