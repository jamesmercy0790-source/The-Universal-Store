import Link from "next/link";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Shop",
    links: [
      { href: "/shop?filter=new-arrivals", label: "New Arrivals" },
      { href: "/shop?filter=bestsellers", label: "Best Sellers" },
      { href: "/categories", label: "Categories" },
      { href: "/shop?filter=deals", label: "Deals" }
    ]
  },
  {
    title: "Customer Care",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/shipping", label: "Shipping" },
      { href: "/returns", label: "Returns" },
      { href: "/track-order", label: "Track Order" }
    ]
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About Us" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" }
    ]
  },
  {
    title: "Account",
    links: [
      { href: "/account", label: "My Account" },
      { href: "/account/orders", label: "Orders" },
      { href: "/wishlist", label: "Wishlist" }
    ]
  }
];

export function Footer() {
  return (
    <footer className="border-t border-ink-800 bg-ink-900">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-12 sm:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col.title} className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-[0.2em] text-brass-400">{col.title}</h3>
            <ul className="flex flex-col gap-2 text-sm text-bone-500">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-bone-100">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-ink-800 px-6 py-6 text-center text-xs text-bone-500">
        © {new Date().getFullYear()} The Universal Store. All rights reserved.
      </div>
    </footer>
  );
}
