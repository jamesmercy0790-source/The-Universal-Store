import Link from "next/link";
import { listAdminNotifications } from "@/lib/services/admin-notifications";
import { NotificationRow } from "@/components/admin/NotificationRow";
import { MarkAllReadButton } from "@/components/admin/MarkAllReadButton";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

export default async function AdminNotificationsPage({ searchParams }: Props) {
  const { filter } = await searchParams;
  const unreadOnly = filter === "unread";

  const notifications = await listAdminNotifications({ unreadOnly });
  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl text-bone-100">Notifications</h1>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 text-sm">
            <Link
              href="/admin/notifications"
              className={!unreadOnly ? "text-brass-400" : "text-bone-500 hover:text-bone-300"}
            >
              All
            </Link>
            <Link
              href="/admin/notifications?filter=unread"
              className={unreadOnly ? "text-brass-400" : "text-bone-500 hover:text-bone-300"}
            >
              Unread
            </Link>
          </div>
          <MarkAllReadButton disabled={!hasUnread} />
        </div>
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-sm border border-dashed border-ink-700 px-6 py-16 text-center text-sm text-bone-500">
          {unreadOnly ? "No unread notifications." : "No notifications yet."}
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-ink-800 rounded-sm border border-ink-700 bg-ink-900">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              id={n.id}
              type={n.type}
              title={n.title}
              body={n.body}
              isRead={n.is_read}
              createdAt={n.created_at}
            />
          ))}
        </div>
      )}
    </div>
  );
}
