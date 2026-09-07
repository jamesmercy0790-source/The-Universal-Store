# The Universal Store

One Store. Everything You Need.

Next.js (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth,
Storage, Realtime), deployed on Vercel. CJdropshipping is the initial
supplier; Paystack and Flutterwave are the initial payment providers.
Resend handles transactional email. See `ARCHITECTURE.md` for the full
plan, schema, and rationale — this file is setup steps only.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

No custom domain yet — the Vercel preview/production URL is used for
OAuth redirects and webhook endpoints until a domain is connected. Update
`NEXT_PUBLIC_SITE_URL`, the Google OAuth redirect URI, and both payment
providers' webhook URLs when that changes.

## Setting up each external service

### 1. Supabase
1. Create a project at supabase.com.
2. Project Settings → API: copy the Project URL and `anon` `public` key into
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Copy the `service_role` key into `SUPABASE_SERVICE_ROLE_KEY` — **server-only,
   never in a client component or NEXT_PUBLIC_ var.**
4. Run the migrations in `supabase/migrations/` in order (via the Supabase
   CLI: `supabase db push`, or paste them into the SQL editor in order).

### 2. Google OAuth (for "Continue with Google")
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth
   client ID (type: Web application).
2. Add your Supabase project's callback URL as an authorized redirect URI —
   found in Supabase under Authentication → Providers → Google, which shows
   the exact URL to paste back into Google Cloud.
3. Paste the Google Client ID and Client Secret into Supabase's Google
   provider settings (not into this app's env vars — Supabase handles the
   OAuth exchange directly).

### 3. CJdropshipping
1. Log in at cjdropshipping.com. Under **Apps**, install the **API** app
   (under the "Others" category) if you haven't already.
2. Go to **My CJ → Authorization → API**, click **Add API**, set Type to
   **API Key**, confirm.
3. Copy the generated API Key into `CJ_API_KEY`.
4. That's it for authentication — `lib/suppliers/cj/auth.ts` handles
   exchanging it for an access/refresh token pair and caching/refreshing
   automatically. The **business** endpoints (product import, freight
   calculation, order submission, tracking) are still scaffolded, not
   wired — each gets implemented once its specific contract is pulled
   from CJ's live docs, same as auth was.

### 4. Paystack
1. Create an account at paystack.com, complete business verification.
2. Settings → API Keys & Webhooks: copy the secret key into
   `PAYSTACK_SECRET_KEY` and the public key into
   `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`.
3. In the same page, set the webhook URL to
   `https://<your-vercel-url>/api/webhooks/paystack`.
4. Confirm which currencies your account is approved to settle in (this
   affects `supportedCurrencies()` in `lib/payments/paystack/client.ts`).

### 5. Flutterwave
1. Create an account at flutterwave.com, complete business verification.
2. Settings → API: copy the secret key, public key, and encryption key into
   `FLUTTERWAVE_SECRET_KEY`, `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`,
   `FLUTTERWAVE_ENCRYPTION_KEY`.
3. Settings → Webhooks: set the URL to
   `https://<your-vercel-url>/api/webhooks/flutterwave` and set a secret
   hash — put that same value in `FLUTTERWAVE_WEBHOOK_SECRET_HASH`.
4. Confirm which currencies/payment methods are enabled on your account
   (affects `supportedCurrencies()` in `lib/payments/flutterwave/client.ts`).

### 6. Resend
1. Create an account at resend.com.
2. Verify a sending domain (or use their test domain for development).
3. API Keys → create a key → `RESEND_API_KEY`.
4. Set `EMAIL_FROM_ADDRESS` to an address on your verified domain.

### 7. Exchange rate provider
Default wiring is exchangerate.host — sign up, put the key in
`EXCHANGE_RATE_API_KEY`. To use a different provider, implement
`ExchangeRateProvider` in `lib/currency/service.ts` and update
`EXCHANGE_RATE_PROVIDER`.

### 8. Vercel
1. Import this repo at vercel.com.
2. Add every var from `.env.example` in Project Settings → Environment
   Variables (mark service-role/secret keys as "sensitive").
3. Set `CRON_SECRET` to a random 32+ character string — Vercel Cron sends
   it automatically as a Bearer token to the `/api/cron/*` routes,
   matching `vercel.json`.
4. Deploy. No custom domain needed yet — use the assigned `*.vercel.app` URL,
   and update the OAuth/webhook URLs above to match it.

## Testing

Automated tests live next to the code they cover (`lib/**/__tests__/*.test.ts`)
plus a shared fake-Supabase helper in `test/helpers/`. Run them with:

```bash
npm install
npm test
```

These are unit/integration tests against an in-memory fake of the
Supabase query builder and mocked payment providers — they don't need
real credentials or a live database, and don't make any network calls.
They cover: server-side price/quantity/availability validation (a
manipulated client price or quantity is rejected, not trusted), payment
provider routing for unsupported currencies/countries, webhook-driven
payment reconciliation (paid/failed/pending, amount-mismatch flagging,
duplicate-webhook idempotency), checkout order-creation idempotency
(retrying with the same key never creates a second order), and guest→
account cart merging (including dropping invalid items and combining
quantities against an existing account cart).

## Project status

Phases 1 (scaffold), 2 (schema + RLS), 3 (authentication), and a first
pass of 4 (storefront shell) are in this pass, along with the payment/
supplier abstraction layers requested for review. See `ARCHITECTURE.md`
→ Development Phases for what's next.

## Brand assets

The real logo and hero banner live in `public/brand/` (`logo.jpg`,
`hero-banner.jpg`) and are wired into the header, homepage hero,
favicon (`app/icon.jpg`), and Open Graph share image
(`app/opengraph-image.jpg`). Replace those files directly to update the
brand assets everywhere at once — nothing else needs to change.
