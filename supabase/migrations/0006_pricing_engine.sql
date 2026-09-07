-- 0006_pricing_engine.sql
-- Adds the three-level margin override columns (global lives in `settings`,
-- category and product overrides live on their own tables), latest-known
-- supplier shipping cost (separate from product cost, both dynamic), and
-- the order-time snapshot columns needed so historical orders never
-- change when CJ's cost or the global margin setting changes later.

-- ── Pricing levels ──────────────────────────────────────────────
alter table categories add column margin_override_percent numeric(5,2);
alter table products add column margin_override_percent numeric(5,2);
alter table products add column supplier_shipping_cost_cents int not null default 0;
alter table products add column supplier_cost_updated_at timestamptz;

comment on column categories.margin_override_percent is 'True profit margin (0-100), overrides the global default for every product in this category unless the product itself has an override.';
comment on column products.margin_override_percent is 'True profit margin (0-100) for this specific product. Takes priority over category and global defaults.';
comment on column products.supplier_shipping_cost_cents is 'Latest known supplier-side shipping/fulfillment cost, updated on sync. Historical orders use their own order_items snapshot, never this live value.';

-- ── Order-time commercial snapshot (Section 15) ────────────────
alter table order_items add column supplier_shipping_cost_cents int not null default 0;
alter table order_items add column margin_percent_used numeric(5,2);
alter table order_items add column gross_profit_cents int;

comment on column order_items.margin_percent_used is 'The margin percent actually applied when this line was priced, preserved even if the product/category/global margin changes later.';
comment on column order_items.gross_profit_cents is 'unit_price_cents - supplier_cost_cents - supplier_shipping_cost_cents, per unit, snapshotted at order time.';

-- ── CJ fulfillment sync metadata ────────────────────────────────
alter table supplier_orders add column logistic_name text;
alter table supplier_orders add column cj_order_status text;
alter table supplier_orders add column cj_sub_status text;

alter table product_variants add column supplier_cost_synced_at timestamptz;
alter table products add column supplier_sync_status text; -- 'ok' | 'unavailable' | 'error', set by the sync job

-- ── Global default margin (Section 10) ──────────────────────────
insert into settings (key, value_json) values
  ('pricing_rules', '{"default_profit_margin_percent": 30}')
on conflict (key) do update set value_json = settings.value_json || excluded.value_json;
