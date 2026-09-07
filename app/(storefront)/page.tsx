import type { Metadata } from "next";
import { Hero } from "@/components/storefront/Hero";
import { TrustBar } from "@/components/storefront/TrustBar";
import { CategoryRail } from "@/components/storefront/CategoryRail";
import { ProductRail } from "@/components/storefront/ProductRail";
import { Newsletter } from "@/components/storefront/Newsletter";

export const metadata: Metadata = {
  title: "The Universal Store — One Store. Everything You Need."
};

// Category/product sections read from Supabase at request time (Section
// 13/14: nothing here is hard-coded) — revisit with ISR revalidation once
// the catalog is live and change frequency is understood (Phase 13).
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <TrustBar />
      <CategoryRail />
      <ProductRail title="Featured" flag="is_featured" />
      <ProductRail title="New Arrivals" flag="is_new_arrival" />
      <ProductRail title="Proven Bestsellers" flag="is_bestseller" />
      <Newsletter />
    </main>
  );
}
