-- 0007_cron_dispatch.sql
-- Backs the consolidated cron dispatcher (see app/api/cron/dispatch).
-- Vercel's Hobby plan only fires a native cron job once per day (with an
-- imprecise ~1hr window) — this project's real jobs need finer cadences
-- (hourly/every 6h/every 30min/every 15min), so a single dispatcher
-- endpoint is meant to be hit frequently by either Vercel Cron (Pro+) or
-- a free external scheduler, and this table is what lets the dispatcher
-- decide which underlying job is actually due each time it's called,
-- regardless of how often the caller itself fires.

create table cron_job_state (
  job_name text primary key,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table cron_job_state enable row level security;
-- No policies — service-role only, same reasoning as supplier_tokens.

insert into cron_job_state (job_name) values
  ('refresh-rates'),
  ('sync-inventory'),
  ('poll-tracking'),
  ('retry-fulfillment')
on conflict (job_name) do nothing;
