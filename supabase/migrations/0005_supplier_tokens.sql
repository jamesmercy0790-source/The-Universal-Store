-- 0005_supplier_tokens.sql
-- Caches supplier API tokens (CJ's access/refresh token pair) so we don't
-- call getAccessToken on every request — CJ's own docs specify a 1
-- request/second rate limit and note the endpoint itself server-side
-- caches for 24h anyway. RLS is enabled with NO policies at all: neither
-- anon nor authenticated roles get any access, so only the service-role
-- client (used exclusively in server-side supplier adapter code) can
-- ever read or write this table. Nothing here is reachable from the
-- browser under any circumstance.

create table supplier_tokens (
  id uuid primary key default gen_random_uuid(),
  supplier text not null unique, -- 'cj', future suppliers get their own row
  open_id text,
  access_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token text not null,
  refresh_token_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table supplier_tokens enable row level security;
-- Intentionally zero policies — see comment above.
