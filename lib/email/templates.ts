/**
 * Branded HTML templates for every transactional email this store sends.
 * All wrap the same shell (logo, dark/gold brand colors, footer) so a
 * customer only ever sees THE UNIVERSAL STORE as the sender — CJ is
 * never surfaced as the seller identity in anything customer-facing.
 */

function shell(bodyHtml: string): string {
  return `
  <div style="background:#0a0908;padding:32px 16px;font-family:Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#121110;border:1px solid #2a2724;border-radius:4px;overflow:hidden;">
      <div style="padding:24px;text-align:center;border-bottom:1px solid #2a2724;">
        <span style="color:#f6f3ee;font-size:18px;letter-spacing:0.05em;">THE UNIVERSAL STORE</span>
      </div>
      <div style="padding:24px;color:#d8d2c7;font-size:14px;line-height:1.6;">
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #2a2724;color:#9c9488;font-size:11px;text-align:center;">
        THE UNIVERSAL STORE — One Store. Everything You Need.
      </div>
    </div>
  </div>`;
}

function money(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export function orderConfirmedEmail(params: {
  orderNumber: string;
  totalCents: number;
  currency: string;
  itemTitles: string[];
}): { subject: string; html: string } {
  return {
    subject: `Order confirmed — ${params.orderNumber}`,
    html: shell(`
      <p>Thanks for your order! We've received your payment and your order is now being processed.</p>
      <p><strong style="color:#f6f3ee;">Order ${params.orderNumber}</strong></p>
      <ul>${params.itemTitles.map((t) => `<li>${t}</li>`).join("")}</ul>
      <p>Total: <strong style="color:#f6f3ee;">${money(params.totalCents, params.currency)}</strong></p>
      <p>We'll email you again as soon as it ships.</p>
    `)
  };
}

export function paymentFailedEmail(params: { orderNumber: string }): { subject: string; html: string } {
  return {
    subject: `Payment issue with order ${params.orderNumber}`,
    html: shell(`
      <p>We weren't able to confirm payment for order <strong style="color:#f6f3ee;">${params.orderNumber}</strong>.</p>
      <p>No charge should have been completed. Please try again, or contact us if you believe this is an error.</p>
    `)
  };
}

export function orderShippedEmail(params: {
  orderNumber: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}): { subject: string; html: string } {
  return {
    subject: `Your order has shipped — ${params.orderNumber}`,
    html: shell(`
      <p>Good news — order <strong style="color:#f6f3ee;">${params.orderNumber}</strong> is on its way.</p>
      ${params.trackingNumber ? `<p>Tracking number: <strong style="color:#f6f3ee;">${params.trackingNumber}</strong></p>` : ""}
      ${params.trackingUrl ? `<p><a href="${params.trackingUrl}" style="color:#c69a4c;">Track your package →</a></p>` : ""}
    `)
  };
}

export function orderDeliveredEmail(params: { orderNumber: string }): { subject: string; html: string } {
  return {
    subject: `Delivered — ${params.orderNumber}`,
    html: shell(`
      <p>Order <strong style="color:#f6f3ee;">${params.orderNumber}</strong> has been marked delivered.</p>
      <p>We hope you love it. If anything isn't right, just reply to this email or reach us from the
      Contact page.</p>
    `)
  };
}

export function adminFulfillmentFailureEmail(params: { orderNumber: string; error: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: `⚠ Fulfillment failed — ${params.orderNumber}`,
    html: shell(`
      <p>Automatic CJ fulfillment failed for order <strong style="color:#f6f3ee;">${params.orderNumber}</strong>.</p>
      <p style="color:#c25450;">${params.error}</p>
      <p>Check /admin/orders/${params.orderNumber} for details. The retry cron will keep attempting this
      automatically, up to the configured retry limit.</p>
    `)
  };
}
