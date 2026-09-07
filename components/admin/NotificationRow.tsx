"use client";

import Link from "next/link";
import { useTransition } from "react";
import { markNotificationRead } from "@/lib/services/admin-notifications";

interface Props {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_STYLE: Record<string, string> = {
  new_payment: "text-signal-success",
  failed_payment: "text-signal-danger",
  payment_mismatch: "text-signal-warning"
};

const TYPE_LABEL: Record<string, string> = {
  new_payment: "Payment received",
  failed_payment: "Payment failed",
  payment_mismatch: "Needs review"
};

function extractOrderNumber(text: string): string | null {
  const match = text.match(/TUS-\d+/);
  return match ? match[0] : null;
}

export function NotificationRow({ id, type, title, body, isRead, createdAt }: Props) {
  const [pending, startTransition] = useTransition();
  const orderNumber = extractOrderNumber(title) ?? (body ? extractOrderNumber(body) : null);

  return (
    <div className={`flex items-start justify-between gap-4 px-5 py-4 ${isRead ? "" : "bg-ink-800/40"}`}>
      <div className="flex flex-col gap-1">
        <span className={`text-xs font-medium uppercase tracking-wide ${TYPE_STYLE[type] ?? "text-bone-500"}`}>
          {TYPE_LABEL[type] ?? type}
        </span>
        <p className="text-sm text-bone-100">{title}</p>
        {body && <p className="text-xs text-bone-500">{body}</p>}
        <p className="text-xs text-bone-600">{new Date(createdAt).toLocaleString()}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {orderNumber && (
          <Link href={`/account/orders/${orderNumber}`} className="text-xs text-brass-400 hover:text-brass-300">
            View order →
          </Link>
        )}
        {!isRead && (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => markNotificationRead(id))}
            className="text-xs text-bone-500 hover:text-bone-100"
          >
            Mark as read
          </button>
        )}
      </div>
    </div>
  );
}
