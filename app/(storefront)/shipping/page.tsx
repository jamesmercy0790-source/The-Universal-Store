import type { Metadata } from "next";

export const metadata: Metadata = { title: "Shipping" };

export default function ShippingPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <span className="text-xs uppercase tracking-[0.3em] text-brass-400">Shipping</span>
      <h1 className="mt-2 font-display text-3xl text-bone-100">Shipping Policy</h1>

      <div className="mt-6 flex flex-col gap-5 text-sm leading-relaxed text-bone-300">
        <p>
          THE UNIVERSAL STORE ships internationally through our fulfillment partners. Because we
          work with a global supplier network rather than a single warehouse, exact shipping
          availability, cost, and delivery estimates depend on the product, your destination
          country, and the shipping line available for that route — we show the real,
          current figures for your destination on every product page and again at checkout,
          rather than a single blanket promise.
        </p>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Delivery estimates</h2>
          <p>
            Typical international delivery times range from roughly <strong className="text-bone-100">7 to 20 days</strong>{" "}
            depending on the destination and shipping line used, with some routes and warehouse-stocked
            items arriving faster. Estimates shown at checkout are our best available information at
            the time of order, not a guarantee — customs processing, peak-season volume, weather, and
            other events outside our control can extend delivery times.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Order processing</h2>
          <p>
            Orders are processed and handed to our fulfillment partner after payment is confirmed.
            Processing time is separate from, and in addition to, the shipping estimate shown for
            your item.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Tracking</h2>
          <p>
            Once your order ships, tracking information is added to your account and to the{" "}
            <a href="/track-order" className="text-brass-400 hover:text-brass-300">order tracking</a> page.
            Some international shipping lines use two tracking numbers — one for the origin
            country and one for the destination country — since final delivery is often handed
            off to your local postal service.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Destination availability</h2>
          <p>
            Not every product can be shipped to every country. We check destination availability
            for each product before allowing it into checkout, and we'll never let you complete an
            order for an item that can't currently be delivered to your selected country.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Customs and import duties</h2>
          <p>
            International shipments may be subject to customs fees, import duties, or taxes levied
            by your destination country. These are outside our control and are the responsibility
            of the customer unless otherwise stated at checkout.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-bone-500">Delayed or missing orders</h2>
          <p>
            If your order hasn't arrived well beyond its estimated delivery window, contact us —
            see the <a href="/contact" className="text-brass-400 hover:text-brass-300">Contact</a> page —
            and we'll look into it with our fulfillment partner.
          </p>
        </div>
      </div>
    </main>
  );
}
