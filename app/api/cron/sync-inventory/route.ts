import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { cjProvider } from "@/lib/suppliers/cj/client";

/**
 * Pulls current stock from CJ for every product variant linked to a CJ
 * variant, and updates local inventory — the storefront's own checkout
 * validation (lib/services/pricing.ts) is the actual purchase gate, this
 * just keeps `inventory_qty` from going stale. Never deletes historical
 * order data if a product disappears upstream.
 *
 * A variant CJ doesn't return anything for this run is left untouched
 * (not zeroed) — getInventoryBulk() can't yet distinguish "CJ query
 * failed transiently" from "this variant is genuinely gone," and
 * guessing wrong in either direction is worse than leaving it stale for
 * one more cycle. See HANDOFF.md for the follow-up needed here.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: log } = await supabase
    .from("supplier_sync_logs")
    .insert({ sync_type: "inventory", status: "running" })
    .select("id")
    .single();

  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, product_id, supplier_variant_id")
    .not("supplier_variant_id", "is", null);

  let processed = 0;
  let errorMessage: string | null = null;

  try {
    const ids = (variants ?? []).map((v) => v.supplier_variant_id).filter(Boolean) as string[];
    if (ids.length > 0) {
      const inventory = await cjProvider.getInventoryBulk(ids);
      const now = new Date().toISOString();
      const productIdsSynced = new Set<string>();

      for (const variant of variants ?? []) {
        const qty = variant.supplier_variant_id ? inventory[variant.supplier_variant_id] : undefined;
        if (qty != null) {
          await supabase
            .from("product_variants")
            .update({ inventory_qty: qty, supplier_cost_synced_at: now })
            .eq("id", variant.id);
          productIdsSynced.add(variant.product_id);
          processed += 1;
        }
      }

      if (productIdsSynced.size > 0) {
        await supabase
          .from("products")
          .update({ supplier_sync_status: "ok" })
          .in("id", [...productIdsSynced]);
      }
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  if (errorMessage) {
    await supabase.from("admin_notifications").insert({
      type: "cj_inventory_sync_failed",
      title: "CJ inventory sync failed",
      body: errorMessage
    });
  }

  await supabase
    .from("supplier_sync_logs")
    .update({
      status: errorMessage ? "failed" : "success",
      items_processed: processed,
      error_message: errorMessage,
      finished_at: new Date().toISOString()
    })
    .eq("id", log!.id);

  return NextResponse.json({ processed, error: errorMessage });
}
