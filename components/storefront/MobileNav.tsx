"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface Props {
  navItems: { href: string; label: string }[];
  isSignedIn: boolean;
  countryLabel: string;
}

export function MobileNav({ navItems, isSignedIn, countryLabel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="text-bone-100"
      >
        Menu
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex w-full max-w-xs flex-col gap-6 bg-ink-900 p-6">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Image src="/brand/logo.jpg" alt="" width={32} height={32} className="rounded-full" />
                <span className="font-display text-lg text-bone-100">The Universal Store</span>
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-bone-300">
                Close
              </button>
            </div>

            <nav className="flex flex-col gap-4 text-sm text-bone-300">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="hover:text-brass-400">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-4 border-t border-ink-800 pt-4 text-sm text-bone-300">
              <Link href="/onboarding/country" onClick={() => setOpen(false)} className="hover:text-brass-400">
                {countryLabel}
              </Link>
              <Link href="/search" onClick={() => setOpen(false)} className="hover:text-brass-400">
                Search
              </Link>
              <Link href="/wishlist" onClick={() => setOpen(false)} className="hover:text-brass-400">
                Wishlist
              </Link>
              <Link
                href={isSignedIn ? "/account" : "/account/login"}
                onClick={() => setOpen(false)}
                className="hover:text-brass-400"
              >
                Account
              </Link>
              <Link href="/cart" onClick={() => setOpen(false)} className="hover:text-brass-400">
                Cart
              </Link>
            </div>
          </div>
          <button
            aria-label="Close menu backdrop"
            className="flex-1 bg-ink-950/70"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
