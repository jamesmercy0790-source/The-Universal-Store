import { createServiceRoleClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/services/activity";

/**
 * CJdropshipping API 2.0 authentication, implemented against their
 * current published docs (developers.cjdropshipping.cn/en/api/api2/api/auth.html,
 * verified before writing this file):
 *
 *   POST /authentication/getAccessToken     { apiKey }              -> { accessToken, accessTokenExpiryDate, refreshToken, refreshTokenExpiryDate, openId }
 *   POST /authentication/refreshAccessToken { refreshToken }        -> same shape
 *   POST /authentication/logout             header CJ-Access-Token  -> { data: true }
 *
 * Rate limit is 1 request/second, and CJ's own endpoint server-side
 * caches the token for 24h per account — so this module caches the
 * token pair in `supplier_tokens` (service-role only, no RLS policies at
 * all) and only calls out to CJ when the cached token is actually
 * missing or expired, never on every request.
 *
 * The CJ API key itself (CJ_API_KEY) and every token this module obtains
 * stay server-side: this file is never imported by anything that runs in
 * the browser, and `supplier_tokens` has no RLS policy granting any
 * client-side access.
 */

const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

// Refresh a little before actual expiry so a request never races an
// expiring token mid-flight.
const EXPIRY_SAFETY_MARGIN_MS = 5 * 60 * 1000;

interface CjTokenResponse {
  code: number;
  result: boolean;
  message: string;
  data: {
    openId?: number;
    accessToken: string;
    accessTokenExpiryDate: string;
    refreshToken: string;
    refreshTokenExpiryDate: string;
    createDate: string;
  } | null;
  requestId: string;
  success: boolean;
}

interface CachedToken {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

async function fetchNewAccessToken(): Promise<CachedToken> {
  const apiKey = process.env.CJ_API_KEY;
  if (!apiKey) {
    throw new Error("CJ_API_KEY is not set — cannot authenticate with CJdropshipping.");
  }

  const res = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey })
  });

  const body = (await res.json()) as CjTokenResponse;

  if (!res.ok || !body.success || !body.data) {
    await logActivity({
      actorType: "system",
      eventType: "cj.auth_failed",
      metadata: { step: "getAccessToken", code: body.code, message: body.message }
    });
    throw new Error(`CJ getAccessToken failed: ${body.message ?? "unknown error"}`);
  }

  return {
    accessToken: body.data.accessToken,
    accessTokenExpiresAt: new Date(body.data.accessTokenExpiryDate),
    refreshToken: body.data.refreshToken,
    refreshTokenExpiresAt: new Date(body.data.refreshTokenExpiryDate)
  };
}

async function refreshAccessToken(refreshToken: string): Promise<CachedToken> {
  const res = await fetch(`${CJ_BASE_URL}/authentication/refreshAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  const body = (await res.json()) as CjTokenResponse;

  if (!res.ok || !body.success || !body.data) {
    await logActivity({
      actorType: "system",
      eventType: "cj.auth_failed",
      metadata: { step: "refreshAccessToken", code: body.code, message: body.message }
    });
    throw new Error(`CJ refreshAccessToken failed: ${body.message ?? "unknown error"}`);
  }

  return {
    accessToken: body.data.accessToken,
    accessTokenExpiresAt: new Date(body.data.accessTokenExpiryDate),
    refreshToken: body.data.refreshToken,
    refreshTokenExpiresAt: new Date(body.data.refreshTokenExpiryDate)
  };
}

async function persistToken(token: CachedToken, openId?: number) {
  const supabase = createServiceRoleClient();
  await supabase.from("supplier_tokens").upsert(
    {
      supplier: "cj",
      open_id: openId != null ? String(openId) : undefined,
      access_token: token.accessToken,
      access_token_expires_at: token.accessTokenExpiresAt.toISOString(),
      refresh_token: token.refreshToken,
      refresh_token_expires_at: token.refreshTokenExpiresAt.toISOString()
    },
    { onConflict: "supplier" }
  );
}

/**
 * Returns a valid CJ access token, refreshing or re-authenticating only
 * when actually necessary. This is the only function anything calling
 * the CJ API should use to get a token — never call getAccessToken
 * directly outside this module.
 */
export async function getValidCjAccessToken(): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data: cached } = await supabase
    .from("supplier_tokens")
    .select("access_token, access_token_expires_at, refresh_token, refresh_token_expires_at")
    .eq("supplier", "cj")
    .maybeSingle();

  const now = Date.now();

  if (cached) {
    const accessExpiresAt = new Date(cached.access_token_expires_at).getTime();
    if (accessExpiresAt - EXPIRY_SAFETY_MARGIN_MS > now) {
      return cached.access_token;
    }

    const refreshExpiresAt = new Date(cached.refresh_token_expires_at).getTime();
    if (refreshExpiresAt - EXPIRY_SAFETY_MARGIN_MS > now) {
      const refreshed = await refreshAccessToken(cached.refresh_token);
      await persistToken(refreshed);
      await logActivity({ actorType: "system", eventType: "cj.token_refreshed" });
      return refreshed.accessToken;
    }
    // Both expired — fall through to a fresh getAccessToken call below.
  }

  const fresh = await fetchNewAccessToken();
  await persistToken(fresh);
  await logActivity({ actorType: "system", eventType: "cj.token_issued" });
  return fresh.accessToken;
}
