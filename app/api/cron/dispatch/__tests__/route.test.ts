import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseClient } from "../../../../test/helpers/fakeSupabase";

let fakeClient: ReturnType<typeof createFakeSupabaseClient>;
let fetchMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => fakeClient
}));

const { GET } = await import("../route");

function req() {
  return new Request("https://example.com/api/cron/dispatch", {
    headers: { authorization: "Bearer test-secret" }
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
});

describe("cron dispatch", () => {
  it("rejects a request without the correct bearer token", async () => {
    fakeClient = createFakeSupabaseClient({ cron_job_state: [] });
    const res = await GET(new Request("https://example.com/api/cron/dispatch"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("runs every job on first call when nothing has ever run (last_run_at null)", async () => {
    fakeClient = createFakeSupabaseClient({
      cron_job_state: [
        { job_name: "refresh-rates", last_run_at: null },
        { job_name: "sync-inventory", last_run_at: null },
        { job_name: "poll-tracking", last_run_at: null },
        { job_name: "retry-fulfillment", last_run_at: null }
      ]
    });

    const res = await GET(req());
    const body = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(body.results["refresh-rates"]).toBe("ran");
  });

  it("skips a job whose interval hasn't elapsed yet", async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60_000).toISOString();
    fakeClient = createFakeSupabaseClient({
      cron_job_state: [
        // retry-fulfillment has a 15-minute interval — 2 minutes ago is not due yet.
        { job_name: "retry-fulfillment", last_run_at: twoMinutesAgo }
      ]
    });

    const res = await GET(req());
    const body = await res.json();

    expect(body.results["retry-fulfillment"]).toBe("skipped-not-due");
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("retry-fulfillment"), expect.anything());
  });

  it("runs a job again once its interval has elapsed", async () => {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60_000).toISOString();
    fakeClient = createFakeSupabaseClient({
      cron_job_state: [{ job_name: "retry-fulfillment", last_run_at: twentyMinutesAgo }]
    });

    const res = await GET(req());
    const body = await res.json();

    expect(body.results["retry-fulfillment"]).toBe("ran");
  });

  it("records a failure without throwing when the underlying job route errors", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    fakeClient = createFakeSupabaseClient({
      cron_job_state: [{ job_name: "refresh-rates", last_run_at: null }]
    });

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200); // dispatcher itself doesn't fail just because one job did
    expect(body.results["refresh-rates"]).toContain("failed");

    const state = fakeClient.__store.cron_job_state.find((s) => s.job_name === "refresh-rates");
    expect(state!.last_status).toBe("failed");
  });
});
