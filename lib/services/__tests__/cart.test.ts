import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseClient } from "../../../test/helpers/fakeSupabase";

let fakeClient: ReturnType<typeof createFakeSupabaseClient>;
let cookieStore: Map<string, string>;

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => fakeClient,
  createClient: async () => fakeClient
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => cookieStore.set(name, value),
    delete: (name: string) => cookieStore.delete(name)
  })
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { mergeGuestCartIntoUser } = await import("../cart");

const USER_ID = "user-1111";
const GUEST_CART_ID = "cart-guest-1111";
const USER_CART_ID = "cart-user-1111";
const PRODUCT_A = "product-aaaa";
const PRODUCT_B = "product-bbbb";
const PRODUCT_DISCONTINUED = "product-dddd";

function baseCatalog() {
  return {
    products: [
      { id: PRODUCT_A, status: "active", selling_price_cents: 2000 },
      { id: PRODUCT_B, status: "active", selling_price_cents: 5000 },
      { id: PRODUCT_DISCONTINUED, status: "archived", selling_price_cents: 1000 }
    ]
  };
}

beforeEach(() => {
  cookieStore = new Map([["tus_cart_session", "guest-token-123"]]);
});

describe("mergeGuestCartIntoUser", () => {
  it("moves a guest cart straight into a fresh account cart (guest cart + empty account cart)", async () => {
    fakeClient = createFakeSupabaseClient({
      ...baseCatalog(),
      carts: [{ id: GUEST_CART_ID, session_token: "guest-token-123", status: "active" }],
      cart_items: [
        { id: "ci-1", cart_id: GUEST_CART_ID, product_id: PRODUCT_A, variant_id: null, quantity: 2 }
      ]
    });

    const result = await mergeGuestCartIntoUser(USER_ID);

    expect(result.merged).toBe(1);
    expect(result.dropped).toBe(0);

    const userCarts = fakeClient.__store.carts.filter((c) => c.user_id === USER_ID);
    expect(userCarts).toHaveLength(1);

    const userItems = fakeClient.__store.cart_items.filter((i) => i.cart_id === userCarts[0]!.id);
    expect(userItems).toHaveLength(1);
    expect(userItems[0]!.product_id).toBe(PRODUCT_A);
    expect(userItems[0]!.quantity).toBe(2);

    // Guest cart is converted, not left dangling as "active".
    const guestCart = fakeClient.__store.carts.find((c) => c.id === GUEST_CART_ID);
    expect(guestCart!.status).toBe("converted");

    // Cookie cleared so a stale guest session isn't reused.
    expect(cookieStore.has("tus_cart_session")).toBe(false);
  });

  it("combines quantities instead of duplicating a line already in the account cart", async () => {
    fakeClient = createFakeSupabaseClient({
      ...baseCatalog(),
      carts: [
        { id: GUEST_CART_ID, session_token: "guest-token-123", status: "active" },
        { id: USER_CART_ID, user_id: USER_ID, status: "active" }
      ],
      cart_items: [
        // Guest has 2x product A (already in the account cart) and 1x product B (new).
        { id: "ci-guest-a", cart_id: GUEST_CART_ID, product_id: PRODUCT_A, variant_id: null, quantity: 2 },
        { id: "ci-guest-b", cart_id: GUEST_CART_ID, product_id: PRODUCT_B, variant_id: null, quantity: 1 },
        // Account already has 3x product A from an earlier session.
        { id: "ci-user-a", cart_id: USER_CART_ID, product_id: PRODUCT_A, variant_id: null, quantity: 3 }
      ]
    });

    const result = await mergeGuestCartIntoUser(USER_ID);

    expect(result.merged).toBe(2);

    const userItems = fakeClient.__store.cart_items.filter((i) => i.cart_id === USER_CART_ID);
    const lineA = userItems.find((i) => i.product_id === PRODUCT_A);
    const lineB = userItems.find((i) => i.product_id === PRODUCT_B);

    // Combined, not duplicated: 3 (existing) + 2 (guest) = 5, still one row.
    expect(userItems.filter((i) => i.product_id === PRODUCT_A)).toHaveLength(1);
    expect(lineA!.quantity).toBe(5);
    expect(lineB!.quantity).toBe(1);
  });

  it("drops a discontinued/invalid product rather than carrying it into the account cart", async () => {
    fakeClient = createFakeSupabaseClient({
      ...baseCatalog(),
      carts: [{ id: GUEST_CART_ID, session_token: "guest-token-123", status: "active" }],
      cart_items: [
        { id: "ci-1", cart_id: GUEST_CART_ID, product_id: PRODUCT_A, variant_id: null, quantity: 1 },
        { id: "ci-2", cart_id: GUEST_CART_ID, product_id: PRODUCT_DISCONTINUED, variant_id: null, quantity: 1 }
      ]
    });

    const result = await mergeGuestCartIntoUser(USER_ID);

    expect(result.merged).toBe(1);
    expect(result.dropped).toBe(1);
    expect(result.droppedReasons).toContain("product_unavailable");

    const userCart = fakeClient.__store.carts.find((c) => c.user_id === USER_ID);
    const userItems = fakeClient.__store.cart_items.filter((i) => i.cart_id === userCart!.id);
    expect(userItems.map((i) => i.product_id)).toEqual([PRODUCT_A]);
  });

  it("does nothing when there is no guest cart cookie", async () => {
    cookieStore.clear();
    fakeClient = createFakeSupabaseClient(baseCatalog());

    const result = await mergeGuestCartIntoUser(USER_ID);

    expect(result.merged).toBe(0);
    expect(result.dropped).toBe(0);
  });
});
