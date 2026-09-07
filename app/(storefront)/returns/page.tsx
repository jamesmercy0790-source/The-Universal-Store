import type { Metadata } from "next";

export const metadata: Metadata = { title: "Returns & Refunds" };

export default function ReturnsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Returns & Refunds</span>
      <h1 className="mt-2 font-display text-3xl text-bone-100">Returns & Refunds Policy</h1>

      <div className="mt-6 flex flex-col gap-5 text-sm leading-relaxed text-bone-300">
        <p>
          THE UNIVERSAL STORE works with global fulfillment partners rather than shipping from a
          single central warehouse. Because of this, physically returning an item to the original
          fulfillment point is often impractical — international return shipping is expensive and
          can take months, and many items are lost in transit before arriving. Instead, we resolve
          issues through refunds, replacements, or store credit, as set out below.
        </p>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">
            You're covered if your order is:
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Damaged or defective on arrival</li>
            <li>Materially different from what was ordered (wrong item, wrong variant)</li>
            <li>Lost in transit</li>
            <li>Significantly delayed beyond the estimated delivery window</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">How to request a resolution</h2>
          <p>
            Contact us via the <a href="/contact" className="text-brass-400 hover:text-brass-300">Contact</a>{" "}
            page with your order number and, for damaged or incorrect items, photos of what
            arrived. We'll review the issue with our fulfillment partner and offer a refund,
            replacement/resend, or store credit — whichever fits the situation.
          </p>
          <p className="mt-2">
            Please report damaged, defective, or incorrect items within <strong className="text-bone-100">14 days</strong>{" "}
            of delivery. For orders that never arrive, please allow at least{" "}
            <strong className="text-bone-100">45 days</strong> from your order date (60 days for
            some international routes) before requesting a resolution, since that's the window our
            fulfillment partner needs to confirm a shipment as genuinely lost rather than simply
            slow.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Change of mind</h2>
          <p>
            Because products are sourced and shipped per order through our fulfillment partners,
            we generally can't accept change-of-mind returns once an order has shipped. If you need
            to cancel or change an order, contact us as soon as possible — we can only make changes
            before the order has been submitted for fulfillment.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Refund processing</h2>
          <p>
            Approved refunds are issued back to your original payment method and may take several
            business days to appear, depending on your payment provider and bank.
          </p>
        </div>
      </div>
    </main>
  );
}
