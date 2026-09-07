import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getShopperLocale } from "@/lib/services/geo";
import { MobileNav } from "./MobileNav";

const PRIMARY_NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/categories", label: "Categories" },
  { href: "/shop?filter=new-arrivals", label: "New Arrivals" },
  { href: "/shop?filter=bestsellers", label: "Best Sellers" },
  { href: "/shop?filter=deals", label: "Deals" }
];

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { countryCode, currencyCode } = await getShopperLocale();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
      <div className="border-b border-ink-800 bg-ink-900 px-6 py-2 text-center text-[11px] uppercase tracking-[0.25em] text-bone-500">
        One Store. Everything You Need. — Shop Now & Discover More
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/brand/logo.jpg"
            alt="The Universal Store"
            width={44}
            height={44}
            className="rounded-full"
            priority
          />
          <span className="hidden font-display text-lg tracking-wide text-bone-100 sm:inline">
            The Universal Store
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-bone-300 lg:flex">
          {PRIMARY_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-brass-400">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link
            href="/onboarding/country"
            className="text-xs uppercase tracking-wide text-bone-500 hover:text-brass-400"
          >
            {countryCode ? `${countryCode} · ${currencyCode}` : "Select country"}
          </Link>
          <Link href="/search" aria-label="Search" className="text-bone-300 hover:text-brass-400">
            Search
          </Link>
          <Link href="/wishlist" aria-label="Wishlist" className="text-bone-300 hover:text-brass-400">
            Wishlist
          </Link>
          <Link
            href={user ? "/account" : "/account/login"}
            aria-label="Account"
            className="text-bone-300 hover:text-brass-400"
          >
            Account
          </Link>
          <Link href="/cart" aria-label="Cart" className="text-bone-300 hover:text-brass-400">
            Cart
          </Link>
        </div>

        <MobileNav
          navItems={PRIMARY_NAV}
          isSignedIn={Boolean(user)}
          countryLabel={countryCode ? `${countryCode} · ${currencyCode}` : "Select country"}
        />
      </div>
    </header>
  );
}
