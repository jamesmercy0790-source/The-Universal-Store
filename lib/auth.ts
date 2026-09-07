import { createClient } from "@/lib/supabase/server";

const ADMIN_ROLES = new Set(["admin", "support", "order_manager"]);

/**
 * Call at the top of every admin Server Action / Route Handler. Throws if
 * the caller isn't authenticated or doesn't hold an admin-tier role.
 * This is the explicit, code-level check that backs up RLS — never rely on
 * RLS alone to gate something as sensitive as /admin (see architecture
 * plan, Section A.9).
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profile || !ADMIN_ROLES.has(profile.role)) {
    throw new Error("FORBIDDEN");
  }

  return { user, role: profile.role as string };
}

/** Call in customer-facing Server Actions that require a logged-in user. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }

  return user;
}
