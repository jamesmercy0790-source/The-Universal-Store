import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/services/admin-notifications";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/taxes", label: "Taxes" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/cj", label: "Import from CJ" },
  { href: "/admin/settings", label: "Settings" }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      redirect("/account/login?redirect=/admin");
    }
    // FORBIDDEN (signed in, not an admin) — don't reveal /admin exists in
    // any more detail than a plain redirect home.
    redirect("/");
  }

  const unreadCount = await getUnreadNotificationCount();

  return (
    <div className="min-h-screen bg-ink-950 text-bone-100">
      <div className="border-b border-ink-800 bg-ink-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-lg">The Universal Store — Admin</span>
          <nav className="flex items-center gap-6 text-sm text-bone-300">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-brass-400">
                {item.label}
                {item.href === "/admin/notifications" && unreadCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-brass-500 px-1.5 py-0.5 text-[10px] font-medium text-ink-950">
                    {unreadCount}
                  </span>
                )}
              </Link>
            ))}
            <Link href="/" className="text-bone-500 hover:text-bone-300">
              ← Back to store
            </Link>
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
    </div>
  );
}
