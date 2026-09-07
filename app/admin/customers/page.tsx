import Link from "next/link";
import { listAdminCustomers } from "@/lib/services/admin-customers";
import { convertUsdCents } from "@/lib/currency/service";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminCustomersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const { customers, total } = await listAdminCustomers({ search: q });

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl text-bone-100">Customers ({total})</h1>

      <form className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          className="rounded-sm border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-bone-100 outline-none focus:border-brass-500"
        />
      </form>

      <div className="overflow-x-auto rounded-sm border border-ink-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900 text-xs uppercase tracking-wide text-bone-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Registered</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Total spent</th>
              <th className="px-4 py-3">Last order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800 text-bone-300">
            {customers.map((c: any) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/customers/${c.id}`} className="text-bone-100 hover:text-brass-400">
                    {c.full_name || c.email || "Unnamed customer"}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.country_code ?? "—"}</td>
                <td className="px-4 py-3">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">{c.orderCount}</td>
                <td className="px-4 py-3">${(c.totalSpentUsdCents / 100).toFixed(2)}</td>
                <td className="px-4 py-3">{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-bone-500">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
