import type { PaymentProvider, SupportedCurrency } from "./types";
import { paystackProvider } from "./paystack/client";
import { flutterwaveProvider } from "./flutterwave/client";

const PROVIDERS: PaymentProvider[] = [paystackProvider, flutterwaveProvider];

/**
 * Country/currency → preferred provider order. This is a starting default,
 * not a permanent hard-code — Phase 10 (admin settings) should move this
 * table into the `settings` row so it's editable without a deploy, per
 * "make it easy to add additional providers later without rewriting
 * checkout." Adding Stripe later is: write lib/payments/stripe/client.ts
 * implementing PaymentProvider, add it to PROVIDERS, add its rows here.
 *
 * The store currently supports NGN, USD, and EUR only — Paystack is
 * prioritized for Nigeria (NGN), Flutterwave everywhere else (USD/EUR).
 */
const COUNTRY_PROVIDER_PRIORITY: Record<string, PaymentProvider["id"][]> = {
  NG: ["paystack", "flutterwave"]
  // All other countries fall through to DEFAULT_PRIORITY below.
};

const DEFAULT_PRIORITY: PaymentProvider["id"][] = ["flutterwave", "paystack"];

export class UnsupportedPaymentRouteError extends Error {
  constructor(countryCode: string, currency: string) {
    super(`No configured payment provider supports ${currency} for ${countryCode}.`);
    this.name = "UnsupportedPaymentRouteError";
  }
}

/**
 * Selects the first provider (in priority order for the country) that
 * actually declares support for the requested currency. This is what
 * enforces "never promise a payment method or currency unless the
 * selected provider actually supports it" — if nothing matches, checkout
 * must show the customer an honest "not available" state rather than
 * silently defaulting to a provider that will fail.
 */
export function selectPaymentProvider(
  countryCode: string,
  currency: SupportedCurrency
): PaymentProvider {
  const priority = COUNTRY_PROVIDER_PRIORITY[countryCode] ?? DEFAULT_PRIORITY;

  for (const providerId of priority) {
    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (provider && provider.supportedCurrencies().includes(currency)) {
      return provider;
    }
  }

  throw new UnsupportedPaymentRouteError(countryCode, currency);
}

export function getProviderById(id: PaymentProvider["id"]): PaymentProvider {
  const provider = PROVIDERS.find((p) => p.id === id);
  if (!provider) throw new Error(`Unknown payment provider: ${id}`);
  return provider;
}
