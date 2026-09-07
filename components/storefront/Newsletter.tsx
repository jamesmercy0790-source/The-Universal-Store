import { Button } from "@/components/ui/Button";

export function Newsletter() {
  return (
    <section className="border-t border-ink-800 bg-ink-900 px-6 py-16 text-center">
      <h2 className="font-display text-2xl text-bone-100">Stay in the loop</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-bone-500">
        New arrivals, restocks, and offers — straight to your inbox.
      </p>
      <form className="mx-auto mt-6 flex max-w-sm gap-2">
        <input
          type="email"
          required
          placeholder="you@example.com"
          className="flex-1 rounded-sm border border-ink-700 bg-ink-950 px-4 py-3 text-sm text-bone-100 outline-none placeholder:text-bone-500 focus:border-brass-500"
        />
        <Button type="submit">Subscribe</Button>
      </form>
    </section>
  );
}
