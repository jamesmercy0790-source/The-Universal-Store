import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminCustomerDetail } from "@/lib/services/admin-customers";
import { convertUsdCents } from "@/lib/currency/service";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminCustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await getAdminCustomerDetail(id);
  if (!result) notFound();
  const { profile, orders, addresses } = result;

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl text-bone-100">{profile.full_name || "Unnamed customer"}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-sm border border-ink-700 bg-ink-900 p-5">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Profile</h2>
          <p className="text-sm text-bone-300">Phone: {profile.phone ?? "—"}</p>
          <p className="text-sm text-bone-300">
            Country: {profile.country_code ?? "—"} ({profile.currency_code ?? "—"})
          </p>
          <p className="text-sm text-bone-300">Joined: {new Date(profile.created_at).toLocaleDateString()}</p>
        </section>

        <section className="rounded-sm border border-ink-700 bg-ink-900 p-5">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Addresses</h2>
          {addresses.length === 0 && <p className="text-sm text-bone-500">None saved.</p>}
          {addresses.map((a: any) => (
            <p key={a.id} className="text-sm text-bone-300">
              {a.line1}, {a.city}, {a.country_code}
            </p>
          ))}
        </section>
      </div>

      <section className="mt-6 rounded-sm border border-ink-700 bg-ink-900 p-5">
        <h2 className="mb-3 text-xs uppercase tracking-wide text-bone-500">Orders ({orders.length})</h2>
        <div className="flex flex-col divide-y divide-ink-800">
          {orders.map((o: any) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.order_number}`}
              className="flex justify-between py-2 text-sm text-bone-300 hover:text-brass-400"
            >
              <span>{o.order_number}</span>
              <span>
                {(convertUsdCents(o.total_cents, o.exchange_rate_snapshot) / 100).toFixed(2)} {o.currency_code} ·{" "}
                {o.payment_status}
              </span>
            </Link>
          ))}
          {orders.length === 0 && <p className="py-2 text-sm text-bone-500">No orders yet.</p>}
        </div>
      </section>
    </div>
  );
}
