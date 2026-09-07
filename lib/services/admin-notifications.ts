"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface AdminNotificationFilter {
  unreadOnly?: boolean;
}

/**
 * `admin_notifications` has no RLS policy granting client access at all
 * (see 0001_init_schema.sql) — every read here goes through the
 * service-role client, gated by requireAdmin() at the top of every
 * exported function, never by RLS alone.
 */
export async function listAdminNotifications(filter: AdminNotificationFilter = {}) {
  await requireAdmin();
  const supabase = createServiceRoleClient();

  let query = supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(100);
  if (filter.unreadOnly) query = query.eq("is_read", false);

  const { data } = await query;
  return data ?? [];
}

export async function getUnreadNotificationCount(): Promise<number> {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { count } = await supabase
    .from("admin_notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  await supabase.from("admin_notifications").update({ is_read: true }).eq("id", id);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}

export async function markAllNotificationsRead() {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  await supabase.from("admin_notifications").update({ is_read: true }).eq("is_read", false);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}
