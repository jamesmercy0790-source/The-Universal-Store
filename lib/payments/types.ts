/**
 * Payment provider abstraction. Every provider (Paystack, Flutterwave, and
 * anything added later — Stripe, etc.) implements this same contract.
 * Nothing outside lib/payments/ should import a provider SDK directly —
 * checkout, webhooks, and refund flows only ever talk to this interface.
 */

export type SupportedCurrency = "USD" | "NGN" | "EUR";

export interface CreatePaymentSessionInput {
  orderId: string;
  orderNumber: string;
  amountCents: number; // in the charge currency, already converted — never USD-base blindly
  currency: SupportedCurrency;
  customerEmail: string;
  countryCode: string;
  /** Where the provider should send the browser after payment. */
  callbackUrl: string;
  metadata?: Record<string, string>;
}

export interface PaymentSession {
  provider: "paystack" | "flutterwave";
  /** URL to redirect the customer to, or an embed reference for an in-page widget. */
  authorizationUrl: string;
  providerReference: string;
}

export type PaymentVerificationStatus = "paid" | "pending" | "failed";

export interface PaymentVerificationResult {
  status: PaymentVerificationStatus;
  amountCents: number;
  currency: SupportedCurrency;
  providerReference: string;
  raw: unknown;
}

export interface RefundInput {
  providerReference: string;
  amountCents?: number; // omit for full refund
  reason?: string;
}

export interface PaymentProvider {
  readonly id: "paystack" | "flutterwave";

  /** Currencies this provider is actually configured/approved to settle. */
  supportedCurrencies(): SupportedCurrency[];

  createPaymentSession(input: CreatePaymentSessionInput): Promise<PaymentSession>;

  /** Called after webhook receipt OR browser return — the source of truth either way. */
  verifyPayment(providerReference: string): Promise<PaymentVerificationResult>;

  /**
   * Verifies the raw webhook request is authentically from this provider.
   * Must be checked before any webhook payload is trusted.
   */
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean;

  refund(input: RefundInput): Promise<{ success: boolean; providerRefundId?: string }>;
}
