import type {
  PaymentProvider,
  CreatePaymentSessionInput,
  PaymentSession,
  PaymentVerificationResult,
  RefundInput,
  SupportedCurrency
} from "../types";

// Flutterwave's v3 REST API (api.flutterwave.com/v3, bearer-token auth,
// POST /payments + GET /transactions/verify_by_reference). Confirm against
// https://developer.flutterwave.com before going live, and confirm which
// currencies/payment methods are actually enabled on your merchant account
// per destination country — Flutterwave enables methods per business
// verification, not universally by default.
const BASE_URL = "https://api.flutterwave.com/v3";

function secretKey(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error("FLUTTERWAVE_SECRET_KEY is not set");
  return key;
}

async function flutterwaveFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  const body = await res.json();
  if (!res.ok || body.status === "error") {
    throw new Error(`Flutterwave error (${res.status}): ${body.message ?? "unknown error"}`);
  }
  return body;
}

export const flutterwaveProvider: PaymentProvider = {
  id: "flutterwave",

  supportedCurrencies(): SupportedCurrency[] {
    // TODO: confirm the exact set enabled on your live Flutterwave account.
    // Store currently supports NGN, USD, and EUR — Flutterwave is the
    // "broader international coverage" provider for USD/EUR, with NGN as
    // a fallback behind Paystack.
    return ["USD", "EUR", "NGN"];
  },

  async createPaymentSession(input: CreatePaymentSessionInput): Promise<PaymentSession> {
    const txRef = `${input.orderNumber}-${Date.now()}`;

    const body = await flutterwaveFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: txRef,
        amount: (input.amountCents / 100).toFixed(2),
        currency: input.currency,
        redirect_url: input.callbackUrl,
        customer: { email: input.customerEmail },
        meta: { order_id: input.orderId, ...input.metadata },
        customizations: { title: "The Universal Store" }
      })
    });

    return {
      provider: "flutterwave",
      authorizationUrl: body.data.link,
      providerReference: txRef
    };
  },

  async verifyPayment(providerReference: string): Promise<PaymentVerificationResult> {
    const body = await flutterwaveFetch(
      `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(providerReference)}`
    );
    const data = body.data;

    return {
      status: data.status === "successful" ? "paid" : data.status === "pending" ? "pending" : "failed",
      amountCents: Math.round(data.amount * 100),
      currency: data.currency,
      providerReference: data.tx_ref,
      raw: data
    };
  },

  verifyWebhookSignature(_rawBody: string, headers: Headers): boolean {
    // Flutterwave uses a literal shared-secret header comparison, not an
    // HMAC of the body — the value you set as FLUTTERWAVE_WEBHOOK_SECRET_HASH
    // must match exactly what you configured in the Flutterwave dashboard's
    // webhook settings.
    const receivedHash = headers.get("verif-hash");
    const expectedHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
    if (!receivedHash || !expectedHash) return false;
    return receivedHash === expectedHash;
  },

  async refund(input: RefundInput) {
    // Flutterwave refunds are keyed by the numeric transaction id, not the
    // tx_ref — the service layer is expected to have looked that up via
    // verifyPayment()/webhook payload before calling refund().
    const body = await flutterwaveFetch(`/transactions/${input.providerReference}/refund`, {
      method: "POST",
      body: JSON.stringify({ amount: input.amountCents ? input.amountCents / 100 : undefined })
    });
    return { success: body.status === "success", providerRefundId: body.data?.id?.toString() };
  }
};
