import { createServerClient } from "@supabase/ssr";
import { createClient as createRawSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client, scoped to the requesting user via their
 * session cookie. Respects RLS — use this everywhere except the handful
 * of trusted server operations that need `createServiceRoleClient()` below.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request/response — safe
            // to ignore as long as middleware.ts is also refreshing sessions.
          }
        }
      }
    }
  );
}

/**
 * Service-role client — bypasses RLS entirely. Only for a short, explicit
 * allow-list of server-only operations: webhook handlers writing payment/
 * order state, cron jobs syncing supplier data, and admin actions that have
 * already passed requireAdmin(). Never import this into anything that
 * renders on behalf of a specific request without an explicit auth check
 * first, and never reference it from a Client Component.
 */
export function createServiceRoleClient(): SupabaseClient {
  return createRawSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
