"use client";

import { useTransition } from "react";
import { setProductStatus } from "@/lib/services/admin-products";

interface Props {
  productId: string;
  status: "draft" | "active" | "archived";
}

export function ProductStatusActions({ productId, status }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 text-xs">
      {status !== "active" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => { void setProductStatus(productId, "active") })}
          className="text-signal-success hover:underline"
        >
          Publish
        </button>
      )}
      {status === "active" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => { void setProductStatus(productId, "draft") })}
          className="text-signal-warning hover:underline"
        >
          Unpublish
        </button>
      )}
      {status !== "archived" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => { void setProductStatus(productId, "archived") })}
          className="text-bone-500 hover:text-signal-danger hover:underline"
        >
          Archive
        </button>
      )}
      {status === "archived" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => { void setProductStatus(productId, "draft") })}
          className="text-brass-400 hover:underline"
        >
          Restore
        </button>
      )}
    </div>
  );
}
