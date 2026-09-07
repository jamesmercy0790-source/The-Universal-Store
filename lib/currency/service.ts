import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ExchangeRateProvider } from "./types";

const SUPPORTED_CURRENCIES = ["NGN", "EUR"]; // quote currencies; base is USD

/**
 * Default provider: exchangerate.host. Swap this for any other provider by
 * implementing ExchangeRateProvider and changing this one assignment — see
 * EXCHANGE_RATE_PROVIDER in .env.example. Endpoint shape should be
 * reconfirmed against the provider's current docs before going live; this
 * is written against their commonly documented `/live` endpoint pattern.
 */
const exchangeRateHostProvider: ExchangeRateProvider = {
  id: "exchangerate-host",
  async fetchRates(quoteCodes: string[]) {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) throw new Error("EXCHANGE_RATE_API_KEY is not set");

    const url = `https://api.exchangerate.host/live?access_key=${apiKey}&source=USD&currencies=${quoteCodes.join(",")}`;
    const res = await fetch(url);
    const body = await res.json();

    if (!body.success) {
      throw new Error(`Exchange rate fetch failed: ${JSON.stringify(body.error ?? body)}`);
    }

    const rates: Record<string, number> = {};
    for (const code of quoteCodes) {
      const quoteKey = `USD${code}`;
      if (body.quotes?.[quoteKey] != null) rates[code] = body.quotes[quoteKey];
    }
    return rates;
  }
};

const PROVIDERS: Record<string, ExchangeRateProvider> = {
  "exchangerate-host": exchangeRateHostProvider
};

function activeProvider(): ExchangeRateProvider {
  const configured = process.env.EXCHANGE_RATE_PROVIDER ?? "exchangerate-host";
  const provider = PROVIDERS[configured];
  if (!provider) throw new Error(`Unknown exchange rate provider: ${configured}`);
  return provider;
}

/** Called from /api/cron/refresh-rates on a schedule. */
export async function refreshExchangeRates() {
  const provider = activeProvider();
  const rates = await provider.fetchRates(SUPPORTED_CURRENCIES);
  const supabase = createServiceRoleClient();

  const rows = Object.entries(rates).map(([quote_code, rate]) => ({
    base_code: "USD",
    quote_code,
    rate,
    source: provider.id
  }));

  if (rows.length > 0) {
    await supabase.from("currency_rates").insert(rows);
  }
}

/** Latest known USD -> quoteCode rate. Returns 1 for USD itself. */
export async function getCurrentRate(quoteCode: string): Promise<number> {
  if (quoteCode === "USD") return 1;

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("currency_rates")
    .select("rate")
    .eq("base_code", "USD")
    .eq("quote_code", quoteCode)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) throw new Error(`No exchange rate available for USD -> ${quoteCode} yet`);
  return data.rate;
}

/**
 * Converts a USD-cents amount to the target display currency's smallest
 * unit, for a given rate. Callers that are about to create an order should
 * pass the rate they intend to snapshot onto orders.exchange_rate_snapshot
 * — never recompute it later, so historical orders stay stable when rates
 * change (see 0001_init_schema.sql).
 */
export function convertUsdCents(amountUsdCents: number, rate: number): number {
  return Math.round(amountUsdCents * rate);
}
