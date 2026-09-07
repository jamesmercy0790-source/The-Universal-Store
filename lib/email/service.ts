import { Resend } from "resend";

/**
 * Provider-agnostic send() — the rest of the app calls sendEmail(), never
 * the Resend SDK directly, so swapping providers later (Section 26: "do
 * not hard-code email provider credentials") only touches this file.
 */

let client: Resend | null = null;
function resendClient(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    client = new Resend(key);
  }
  return client;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(input: SendEmailInput) {
  const from = process.env.EMAIL_FROM_ADDRESS ?? "The Universal Store <no-reply@example.com>";
  return resendClient().emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    replyTo: input.replyTo
  });
}

// Template functions are intentionally kept separate (lib/email/templates/*)
// from send transport — Phase 12 fills these in: welcome, verify-email,
// password-reset, order-confirmation, payment-confirmation, shipped,
// tracking-update, delivered, cancelled, refunded, admin-alert.
