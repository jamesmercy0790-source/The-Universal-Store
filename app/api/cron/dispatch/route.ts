import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Why this exists: Vercel's Hobby plan fires a native `vercel.json` cron
 * entry at most once per day (and only within an imprecise ~1hr window) —
 * this project's real jobs need hourly/6-hourly/30-min/15-min cadences,
 * which simply cannot be expressed as a native Hobby cron schedule at
 * all (Vercel rejects anything more frequent than daily at deploy time
 * on Hobby). Upgrading to Pro ($20/mo) would remove that limit, but the
 * brief asked for the cheaper alternative to be evaluated first.
 *
 * The fix: this ONE endpoint is meant to be hit frequently (every 5–15
 * minutes) by a free external scheduler (e.g. cron-job.org — no card,
 * genuinely free tier, supports 1-minute intervals) instead of relying
 * on Vercel's own cron for frequency. It then decides, per job, whether
 * enough time has actually passed since that job's own last successful
 * run — so the external caller's tick rate is just an upper bound, not
 * the real cadence. `vercel.json` still registers this same path as a
 * native once-daily Hobby-compatible cron too, as a safety net in case
 * the external scheduler is ever misconfigured or paused.
 *
 * Each underlying job's own route is untouched — this calls them exactly
 * as any other authenticated caller would (same CRON_SECRET bearer
 * token), so none of that existing, working logic was rewritten.
 */

const JOBS: { name: string; path: string; intervalMinutes: number }[] = [
  { name: "refresh-rates", path: "/api/cron/refresh-rates", intervalMinutes: 60 },
  { name: "sync-inventory", path: "/api/cron/sync-inventory", intervalMinutes: 360 },
  { name: "poll-tracking", path: "/api/cron/poll-tracking", intervalMinutes: 30 },
  { name: "retry-fulfillment", path: "/api/cron/retry-fulfillment", intervalMinutes: 15 }
];

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: states } = await supabase.from("cron_job_state").select("job_name, last_run_at");
  const lastRunByJob = new Map((states ?? []).map((s) => [s.job_name, s.last_run_at as string | null]));

  const now = Date.now();
  const results: Record<string, string> = {};

  for (const job of JOBS) {
    const lastRunAt = lastRunByJob.get(job.name);
    let dueAt = 0;
    if (lastRunAt) {
      dueAt = new Date(lastRunAt).getTime() + job.intervalMinutes * 60_000;
    }

    if (now < dueAt) {
      results[job.name] = "skipped-not-due";
      continue;
    }

    try {
      const res = await fetch(`${siteUrl()}${job.path}`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
      });
      const ok = res.ok;
      await supabase
        .from("cron_job_state")
        .update({
          last_run_at: new Date().toISOString(),
          last_status: ok ? "success" : "failed",
          last_error: ok ? null : `HTTP ${res.status}`
        })
        .eq("job_name", job.name);
      results[job.name] = ok ? "ran" : `failed (HTTP ${res.status})`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("cron_job_state")
        .update({ last_run_at: new Date().toISOString(), last_status: "failed", last_error: message })
        .eq("job_name", job.name);
      results[job.name] = `failed (${message})`;
    }
  }

  return NextResponse.json({ results });
}
