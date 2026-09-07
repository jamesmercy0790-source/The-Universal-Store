"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const q = String(form.get("q") ?? "").trim();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
      }}
      className="mx-auto flex max-w-lg gap-2"
    >
      <input
        name="q"
        type="search"
        defaultValue={searchParams.get("q") ?? ""}
        placeholder="Search products…"
        className="flex-1 rounded-sm border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-bone-100 outline-none placeholder:text-bone-500 focus:border-brass-500"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
