"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { searchCjProducts, type CjSearchResultItem } from "@/lib/services/cj-import";
import { Button } from "@/components/ui/Button";

export function CjSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CjSearchResultItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              const items = await searchCjProducts(query);
              setResults(items);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Search failed.");
            }
          });
        }}
        className="mb-8 flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search CJ products by keyword…"
          className="flex-1 rounded-sm border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-bone-100 outline-none placeholder:text-bone-500 focus:border-brass-500"
        />
        <Button type="submit" disabled={pending || !query.trim()}>
          {pending ? "Searching…" : "Search"}
        </Button>
      </form>

      {error && <p className="mb-4 text-sm text-signal-danger">{error}</p>}

      {results && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {results.length === 0 && <p className="text-sm text-bone-500">No results.</p>}
          {results.map((r) => (
            <Link
              key={r.supplierProductId}
              href={`/admin/cj/import/${r.supplierProductId}`}
              className="flex flex-col gap-2 rounded-sm border border-ink-700 bg-ink-900 p-3 hover:border-brass-500"
            >
              <div className="relative aspect-square overflow-hidden rounded-sm bg-ink-800">
                {r.image && <Image src={r.image} alt={r.title} fill className="object-cover" />}
              </div>
              <span className="line-clamp-2 text-xs text-bone-300">{r.title}</span>
              {r.alreadyImported && (
                <span className="text-[10px] uppercase tracking-wide text-signal-success">Already imported</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
