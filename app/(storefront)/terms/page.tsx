import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Terms</span>
      <h1 className="mt-2 font-display text-3xl text-bone-100">Terms of Service</h1>
      <p className="mt-2 text-xs text-bone-500">Last updated: [date]</p>

      <div className="mt-6 flex flex-col gap-5 text-sm leading-relaxed text-bone-300">
        <p>
          These Terms govern your use of THE UNIVERSAL STORE ("we", "us", "the Store") and any
          purchase you make through it. By creating an account or placing an order, you agree to
          these Terms.
        </p>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Accounts</h2>
          <p>
            You're responsible for keeping your account credentials secure and for all activity
            under your account. Let us know right away if you suspect unauthorized access.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Products and pricing</h2>
          <p>
            We work to display accurate product information, pricing, and availability, but errors
            can occur. If we discover a pricing or listing error after you've placed an order, we'll
            contact you before charging or shipping, and you may cancel for a full refund.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Orders and payment</h2>
          <p>
            Placing an order is an offer to purchase, which we accept once payment is confirmed.
            Payments are processed by our third-party payment providers; we never see or store your
            full card details. Prices are shown in your selected display currency, but the amount
            actually charged is confirmed by the payment provider at the time of payment.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Shipping and delivery</h2>
          <p>
            Shipping availability, cost, and estimated delivery times vary by destination and are
            shown at checkout. See our{" "}
            <a href="/shipping" className="text-brass-400 hover:text-brass-300">Shipping Policy</a>{" "}
            for details.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Returns and refunds</h2>
          <p>
            See our{" "}
            <a href="/returns" className="text-brass-400 hover:text-brass-300">Returns & Refunds Policy</a>{" "}
            for how we handle damaged, incorrect, lost, or delayed orders.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Acceptable use</h2>
          <p>
            You agree not to misuse the Store — including attempting to interfere with its
            operation, security, or other users' accounts, or using it for any unlawful purpose.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Intellectual property</h2>
          <p>
            The Store's branding, design, and original content belong to THE UNIVERSAL STORE.
            Product images and descriptions may belong to our suppliers or manufacturers.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, THE UNIVERSAL STORE is not liable for indirect,
            incidental, or consequential damages arising from your use of the Store, including
            delays or issues caused by third-party fulfillment or payment providers outside our
            direct control.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Changes to these Terms</h2>
          <p>We may update these Terms from time to time. Continued use of the Store after changes means you accept the updated Terms.</p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Governing law</h2>
          <p className="italic text-bone-500">[Governing law and jurisdiction to be confirmed based on the business's registered entity/location.]</p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Contact</h2>
          <p>
            Questions about these Terms? Reach us via the{" "}
            <a href="/contact" className="text-brass-400 hover:text-brass-300">Contact</a> page.
          </p>
        </div>
      </div>
    </main>
  );
}
