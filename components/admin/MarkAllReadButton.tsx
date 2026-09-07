"use client";

import { useTransition } from "react";
import { markAllNotificationsRead } from "@/lib/services/admin-notifications";
import { Button } from "@/components/ui/Button";

export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled || pending}
      onClick={() => startTransition(() => markAllNotificationsRead())}
    >
      {pending ? "Marking…" : "Mark all as read"}
    </Button>
  );
}
