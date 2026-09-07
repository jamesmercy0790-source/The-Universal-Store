import { describe, it, expect } from "vitest";
import { selectPaymentProvider, UnsupportedPaymentRouteError, getProviderById } from "../router";

describe("selectPaymentProvider", () => {
  it("routes a Nigerian customer paying in NGN to Paystack first", () => {
    const provider = selectPaymentProvider("NG", "NGN");
    expect(provider.id).toBe("paystack");
  });

  it("routes a US customer paying in USD to Flutterwave (default priority)", () => {
    const provider = selectPaymentProvider("US", "USD");
    expect(provider.id).toBe("flutterwave");
  });

  it("falls through to Flutterwave for a currency Paystack doesn't declare support for", () => {
    // Paystack's supportedCurrencies() is ["NGN", "USD"] — EUR isn't in
    // it, so even a Nigeria-prioritized country must fall through.
    const provider = selectPaymentProvider("NG", "EUR");
    expect(provider.id).toBe("flutterwave");
  });

  it("throws UnsupportedPaymentRouteError rather than silently picking a provider for a currency nothing supports", () => {
    // Neither adapter declares "XYZ" — this proves checkout can never
    // silently charge someone in a currency no configured provider
    // actually handles (hard constraint #1).
    expect(() => selectPaymentProvider("US", "XYZ" as any)).toThrow(UnsupportedPaymentRouteError);
  });

  it("still resolves a sensible provider for an unlisted country via the default priority", () => {
    // "ZZ" has no entry in COUNTRY_PROVIDER_PRIORITY — must not throw
    // just because the country itself is unrecognized, as long as the
    // currency is supported by the default chain.
    const provider = selectPaymentProvider("ZZ", "USD");
    expect(provider.id).toBe("flutterwave");
  });
});

describe("getProviderById", () => {
  it("returns the matching adapter", () => {
    expect(getProviderById("paystack").id).toBe("paystack");
    expect(getProviderById("flutterwave").id).toBe("flutterwave");
  });

  it("throws for an unknown provider id rather than returning undefined", () => {
    expect(() => getProviderById("stripe" as any)).toThrow();
  });
});
