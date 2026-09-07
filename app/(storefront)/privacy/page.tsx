import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Privacy</span>
      <h1 className="mt-2 font-display text-3xl text-bone-100">Privacy Policy</h1>
      <p className="mt-2 text-xs text-bone-500">Last updated: [date]</p>

      <div className="mt-6 flex flex-col gap-5 text-sm leading-relaxed text-bone-300">
        <p>
          This policy explains what information THE UNIVERSAL STORE ("we", "us") collects when you
          use our website, why we collect it, and who we share it with.
        </p>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Information we collect</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Account information: name, email address, phone number</li>
            <li>Shipping and billing addresses you provide at checkout</li>
            <li>Order history and the products you purchase</li>
            <li>Your selected country and currency preference</li>
            <li>Wishlist and cart contents</li>
            <li>
              Basic activity we log for security and order-processing purposes (e.g. account
              creation, order events) — we do not log passwords, payment card details, or
              authentication secrets
            </li>
          </ul>
          <p className="mt-2">
            We do not collect or store payment card numbers. Payments are processed directly by our
            payment providers (Paystack and/or Flutterwave), who handle your card/payment details
            under their own security and privacy standards.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">How we use your information</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>To create and manage your account</li>
            <li>To process, fulfill, and ship your orders</li>
            <li>To calculate accurate pricing, shipping, and currency conversion for your location</li>
            <li>To send order confirmations, shipping updates, and other transactional emails</li>
            <li>To provide customer support</li>
            <li>To detect and prevent fraud or abuse</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Who we share it with</h2>
          <p>We share the minimum information necessary with:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-bone-100">Our fulfillment partner (CJdropshipping)</strong> —
              your shipping address and order details, so your order can be fulfilled and shipped.
              Because our fulfillment partner operates internationally, this may involve transferring
              your information outside your home country.
            </li>
            <li>
              <strong className="text-bone-100">Payment providers (Paystack, Flutterwave)</strong> —
              information needed to process your payment. We never see or store your full card
              details.
            </li>
            <li>
              <strong className="text-bone-100">Infrastructure providers</strong> (database/hosting,
              transactional email) who process data on our behalf under their own security
              commitments, strictly to operate the store.
            </li>
          </ul>
          <p className="mt-2">We do not sell your personal information.</p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Cookies</h2>
          <p>
            We use essential cookies to keep you signed in, remember your cart and your selected
            country/currency before you create an account, and keep checkout secure. We don't use
            these cookies for third-party advertising.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Your choices</h2>
          <p>
            You can access, update, or request deletion of your account information at any time
            from your account settings, or by contacting us — see the{" "}
            <a href="/contact" className="text-brass-400 hover:text-brass-300">Contact</a> page.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Children's privacy</h2>
          <p>Our store is not directed at children, and we do not knowingly collect information from children.</p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Changes to this policy</h2>
          <p>We may update this policy as our services change. Material changes will be reflected by an updated "last updated" date above.</p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Contact</h2>
          <p>
            Questions about this policy? Reach us via the{" "}
            <a href="/contact" className="text-brass-400 hover:text-brass-300">Contact</a> page.
          </p>
        </div>
      </div>
    </main>
  );
}
