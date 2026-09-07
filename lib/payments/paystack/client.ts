import crypto from "node:crypto";
import type {
  PaymentProvider,
  CreatePaymentSessionInput,
  PaymentSession,
  PaymentVerificationResult,
  RefundInput,
  SupportedCurrency
} from "../types";

// Paystack's REST API is stable and well-documented (api.paystack.co,
// bearer-token auth, /transaction/initialize + /transaction/verify).
// Confirm against https://paystack.com/docs before going live — in
// particular, which currencies your specific Paystack merchant account is
// approved to settle in, since that depends on your business's country of
// registration and is configured on their side, not just in code.
const BASE_URL = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

async function paystackFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  const body = await res.json();
  if (!res.ok || body.status === false) {
    throw new Error(`Paystack error (${res.status}): ${body.message ?? "unknown error"}`);
  }
  return body;
}

// Paystack expects amounts in the currency's smallest unit (kobo for NGN,
// cents for USD). This mirrors our own integer-cents convention directly
// for 2-decimal currencies.
function toSubunit(amountCents: number): number {
  return amountCents;
}

export const paystackProvider: PaymentProvider = {
  id: "paystack",

  supportedCurrencies(): SupportedCurrency[] {
    // TODO: confirm the exact set enabled on your live Paystack account —
    // this defaults to the currencies Paystack most commonly settles for
    // Nigeria-registered merchants.
    return ["NGN", "USD"];
  },

  async createPaymentSession(input: CreatePaymentSessionInput): Promise<PaymentSession> {
    const body = await paystackFetch("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.customerEmail,
        amount: toSubunit(input.amountCents),
        currency: input.currency,
        reference: `${input.orderNumber}-${Date.now()}`,
        callback_url: input.callbackUrl,
        metadata: { order_id: input.orderId, ...input.metadata }
      })
    });

    return {
      provider: "paystack",
      authorizationUrl: body.data.authorization_url,
      providerReference: body.data.reference
    };
  },

  async verifyPayment(providerReference: string): Promise<PaymentVerificationResult> {
    const body = await paystackFetch(
      `/transaction/verify/${encodeURIComponent(providerReference)}`
    );
    const data = body.data;

    return {
      status: data.status === "success" ? "paid" : data.status === "abandoned" ? "pending" : "failed",
      amountCents: data.amount,
      currency: data.currency,
      providerReference: data.reference,
      raw: data
    };
  },

  verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
    const signature = headers.get("x-paystack-signature");
    if (!signature) return false;

    const expected = crypto.createHmac("sha512", secretKey()).update(rawBody).digest("hex");

    // Constant-time comparison to avoid timing attacks.
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },

  async refund(input: RefundInput) {
    const body = await paystackFetch("/refund", {
      method: "POST",
      body: JSON.stringify({
        transaction: input.providerReference,
        amount: input.amountCents,
        merchant_note: input.reason
      })
    });
    return { success: body.status === true, providerRefundId: body.data?.id?.toString() };
  }
};
