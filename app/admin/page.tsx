import Link from "next/link";
import { getAdminOverviewMetrics } from "@/lib/services/admin-metrics";
import { listAdminNotifications } from "@/lib/services/admin-notifications";

export const dynamic = "force-dynamic";

const METRIC_CARDS = (m: Awaited<ReturnType<typeof getAdminOverviewMetrics>>) => [
  { label: "Total orders", value: m.totalOrders },
  { label: "Paid orders", value: m.paidOrders },
  { label: "Pending payments", value: m.pendingPayments },
  { label: "Failed payments", value: m.failedPayments },
  { label: "Revenue (paid orders, USD)", value: `$${(m.totalRevenueUsdCents / 100).toFixed(2)}` }
];

export default async function AdminOverviewPage() {
  const [metrics, recentNotifications] = await Promise.all([
    getAdminOverviewMetrics(),
    listAdminNotifications({ unreadOnly: false })
  ]);

  const preview = recentNotifications.slice(0, 5);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="mb-6 font-display text-2xl text-bone-100">Overview</h1>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {METRIC_CARDS(metrics).map((card) => (
            <div key={card.label} className="rounded-sm border border-ink-700 bg-ink-900 p-4">
              <p className="text-xs uppercase tracking-wide text-bone-500">{card.label}</p>
              <p className="mt-2 font-display text-2xl text-bone-100">{card.value}</p>
            </div>
          ))}
        </div>
        {metrics.totalOrders === 0 && (
          <p className="mt-4 text-xs text-bone-500">
            No orders yet — these figures will reflect real activity as soon as the first order is
            placed. Nothing here is seeded or estimated.
          </p>
        )}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-bone-100">Recent activity</h2>
          <Link href="/admin/notifications" className="text-sm text-brass-400 hover:text-brass-300">
            View all →
          </Link>
        </div>

        {preview.length === 0 ? (
          <p className="rounded-sm border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-bone-500">
            No admin notifications yet.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-ink-800 rounded-sm border border-ink-700 bg-ink-900">
            {preview.map((n) => (
              <div key={n.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className={`text-sm ${n.is_read ? "text-bone-500" : "text-bone-100"}`}>{n.title}</p>
                  <p className="text-xs text-bone-600">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.is_read && <span className="h-2 w-2 rounded-full bg-brass-500" aria-label="Unread" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
