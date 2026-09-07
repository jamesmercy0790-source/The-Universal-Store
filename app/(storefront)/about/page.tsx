import type { Metadata } from "next";

export const metadata: Metadata = { title: "About Us" };

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <span className="text-xs uppercase tracking-[0.3em] text-brass-400">About Us</span>
      <h1 className="mt-2 font-display text-3xl text-bone-100">The Universal Store</h1>

      <div className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-bone-300">
        <p>
          THE UNIVERSAL STORE is a global online shopping store offering a wide range of quality
          products across multiple categories at competitive prices. Our goal is to make online
          shopping simple, convenient, and accessible to customers around the world.
        </p>
        <p>
          We carefully source our products through trusted dropshipping and fulfillment partners,
          allowing us to offer customers a diverse selection without the limitations of a
          traditional physical store.
        </p>
        <p>
          <strong className="text-bone-100">We deliver worldwide.</strong> THE UNIVERSAL STORE
          serves customers across the globe, with products and shipping options available based on
          destination and supplier availability. We are committed to providing a smooth shopping
          experience, secure checkout, reliable order processing, and transparent communication
          from purchase through delivery.
        </p>
      </div>
    </main>
  );
}
