import { randomUUID } from "node:crypto";

/**
 * A small, in-memory stand-in for the subset of the supabase-js query
 * builder our services actually use (.from().select().eq()....single()/
 * .maybeSingle(), plus insert/update/delete). It is NOT a general Postgrest
 * emulator — no real filtering semantics beyond simple equality, no
 * embedded-relation joins, no RLS. It exists purely so pricing/cart/order
 * service logic can be exercised in isolation, the same way a hand-rolled
 * fake or an in-memory repository would in any other codebase.
 *
 * Each `.from(table)` call returns a fresh builder over a shared `store`,
 * so writes in one call are visible to reads in a later call within the
 * same fake client instance — which is what lets a test do
 * `await addSomething(); const rows = client.__store.orders;` and assert
 * on the result.
 */
type Row = Record<string, any>;
type Filter = { col: string; op: "eq" | "is" | "in" | "ilike"; val: any };

class FakeQueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private filters: Filter[] = [];
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private singleMode: "none" | "single" | "maybeSingle" = "none";

  constructor(
    private table: string,
    private store: Record<string, Row[]>
  ) {
    if (!this.store[table]) this.store[table] = [];
  }

  select(_cols?: string) {
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push({ col, op: "eq", val });
    return this;
  }
  ilike(col: string, pattern: string) {
    this.filters.push({ col, op: "ilike", val: pattern });
    return this;
  }
  is(col: string, val: any) {
    this.filters.push({ col, op: "is", val });
    return this;
  }
  in(col: string, vals: any[]) {
    this.filters.push({ col, op: "in", val: vals });
    return this;
  }
  not(_col: string, _op: string, _val: any) {
    return this; // not exercised meaningfully by the functions under test
  }
  or(_expr: string) {
    return this;
  }
  order(_col: string, _opts?: any) {
    return this;
  }
  limit(_n: number) {
    return this;
  }
  range(_from: number, _to: number) {
    return this;
  }
  single() {
    this.singleMode = "single";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }
  insert(payload: Row | Row[]) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  upsert(payload: Row | Row[], _opts?: any) {
    this.mode = "upsert";
    this.payload = payload;
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      const actual = row[f.col] ?? null;
      if (f.op === "eq") return actual === f.val;
      if (f.op === "is") return actual === f.val;
      if (f.op === "in") return (f.val as any[]).includes(actual);
      if (f.op === "ilike") {
        if (actual == null) return false;
        const pattern = String(f.val).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*");
        return new RegExp(`^${pattern}$`, "i").test(String(actual));
      }
      return true;
    });
  }

  private execute(): { data: any; error: any } {
    const rows = this.store[this.table];

    if (this.mode === "select") {
      const matched = rows.filter((r) => this.matches(r));
      if (this.singleMode === "single") {
        return matched.length === 1
          ? { data: matched[0], error: null }
          : { data: null, error: { message: "no rows (or more than one) for .single()" } };
      }
      if (this.singleMode === "maybeSingle") {
        return { data: matched[0] ?? null, error: null };
      }
      return { data: matched, error: null };
    }

    if (this.mode === "insert") {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const now = new Date().toISOString();
      const inserted = incoming.map((r) => ({ id: randomUUID(), created_at: now, updated_at: now, ...r }));
      rows.push(...inserted);
      if (this.singleMode === "single") return { data: inserted[0], error: null };
      if (this.singleMode === "maybeSingle") return { data: inserted[0] ?? null, error: null };
      return { data: inserted, error: null };
    }

    if (this.mode === "update") {
      const matched = rows.filter((r) => this.matches(r));
      matched.forEach((r) => Object.assign(r, this.payload, { updated_at: new Date().toISOString() }));
      if (this.singleMode === "single") return { data: matched[0] ?? null, error: null };
      return { data: matched, error: null };
    }

    if (this.mode === "delete") {
      const matched = rows.filter((r) => this.matches(r));
      this.store[this.table] = rows.filter((r) => !this.matches(r));
      return { data: matched, error: null };
    }

    if (this.mode === "upsert") {
      // No onConflict matching implemented — not exercised by the tests
      // in this suite (only wishlist_items uses upsert, which isn't
      // covered here). Treated as a plain insert.
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const now = new Date().toISOString();
      const inserted = incoming.map((r) => ({ id: randomUUID(), created_at: now, updated_at: now, ...r }));
      rows.push(...inserted);
      return { data: inserted, error: null };
    }

    return { data: null, error: { message: "unsupported operation" } };
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export interface FakeSupabaseClient {
  from(table: string): FakeQueryBuilder;
  /**
   * Typed loosely on purpose: tests read `fakeClient.__store.someTable`
   * for arbitrary table names not known ahead of time, and this project's
   * `noUncheckedIndexedAccess` tsconfig setting would otherwise force a
   * non-null assertion at every single access site across every test
   * file. This is test-only infrastructure, never shipped — the
   * ergonomic trade-off is deliberate here, not an oversight.
   */
  __store: any;
}

/**
 * Creates a fake client seeded with the given tables. Pass the result as
 * the return value of a mocked createServiceRoleClient()/createClient()
 * in a test's `vi.mock("@/lib/supabase/server", ...)`.
 */
export function createFakeSupabaseClient(seed: Record<string, Row[]> = {}): FakeSupabaseClient {
  const store: Record<string, Row[]> = {};
  for (const [table, rows] of Object.entries(seed)) {
    store[table] = rows.map((r) => ({ ...r }));
  }
  return {
    from: (table: string) => new FakeQueryBuilder(table, store),
    __store: store
  };
}
