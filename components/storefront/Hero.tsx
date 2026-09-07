import Image from "next/image";

export function Hero() {
  return (
    <section className="border-b border-ink-800 bg-ink-950">
      {/* The banner already carries the wordmark, tagline, and category
          strip visually — this is the actual brand asset, not a mockup.
          A visually-hidden heading keeps the same content available to
          search engines and screen readers, since text baked into an
          image isn't. */}
      <h1 className="sr-only">The Universal Store — One Store. Everything You Need.</h1>
      <div className="relative mx-auto w-full max-w-7xl">
        <Image
          src="/brand/hero-banner.jpg"
          alt="The Universal Store — One Store. Everything You Need. Accessories, Clothing, Jewelry, Tech & Gadgets, Home & Living, Beauty & More."
          width={1280}
          height={512}
          priority
          sizes="100vw"
          className="h-auto w-full object-cover"
        />
      </div>
    </section>
  );
}
