import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseClient } from "../../../test/helpers/fakeSupabase";

let fakeClient: ReturnType<typeof createFakeSupabaseClient>;

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => fakeClient,
  createClient: async () => fakeClient
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { updateProduct, setProductStatus, setVariantActive } = await import("../admin-products");

const ADMIN_ID = "admin-1111";
const PRODUCT_ID = "product-1111";
const VARIANT_ID = "variant-1111";

function seed() {
  fakeClient = createFakeSupabaseClient({
    profiles: [{ id: ADMIN_ID, role: "admin" }],
    products: [{ id: PRODUCT_ID, title: "Old Title", status: "draft", is_featured: false }],
    product_variants: [{ id: VARIANT_ID, product_id: PRODUCT_ID, is_active: true }]
  });
}

beforeEach(() => {
  seed();
  // fakeClient doubles as both createServiceRoleClient() and createClient() —
  // requireAdmin() calls createClient().auth.getUser(), so the fake needs a
  // minimal auth stub too.
  (fakeClient as any).auth = { getUser: async () => ({ data: { user: { id: ADMIN_ID } } }) };
});

describe("admin product management", () => {
  it("updates product fields", async () => {
    const result = await updateProduct(PRODUCT_ID, { title: "New Title", isFeatured: true });
    expect(result.success).toBe(true);

    const product = fakeClient.__store.products.find((p) => p.id === PRODUCT_ID);
    expect(product!.title).toBe("New Title");
    expect(product!.is_featured).toBe(true);
  });

  it("changes product status (publish/unpublish/archive)", async () => {
    await setProductStatus(PRODUCT_ID, "active");
    expect(fakeClient.__store.products.find((p) => p.id === PRODUCT_ID)!.status).toBe("active");

    await setProductStatus(PRODUCT_ID, "archived");
    expect(fakeClient.__store.products.find((p) => p.id === PRODUCT_ID)!.status).toBe("archived");
  });

  it("toggles a variant's visibility", async () => {
    const result = await setVariantActive(VARIANT_ID, false);
    expect(result.success).toBe(true);
    expect(fakeClient.__store.product_variants.find((v) => v.id === VARIANT_ID)!.is_active).toBe(false);
  });

  it("logs an activity entry for every change", async () => {
    await updateProduct(PRODUCT_ID, { title: "Another Title" });
    const logs = fakeClient.__store.activity_logs.filter((l) => l.entity_id === PRODUCT_ID);
    expect(logs.some((l) => l.event_type === "admin.product_updated")).toBe(true);
  });
});
