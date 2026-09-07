-- 0001_init_schema.sql
-- THE UNIVERSAL STORE — initial schema.
-- Monetary values are integer cents in USD (the internal base currency).
-- RLS policies are added in 0002_rls_policies.sql, kept separate so the
-- shape of the schema is easy to review on its own.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────
create type user_role as enum ('customer', 'admin', 'support', 'order_manager');
create type product_status as enum ('draft', 'active', 'archived');
create type payment_status as enum ('pending', 'paid', 'failed', 'refund_pending', 'refunded');
create type fulfillment_status as enum ('unfulfilled', 'submitted_to_supplier', 'supplier_confirmed', 'fulfilling', 'failed');
create type shipping_status as enum ('pending', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled');
create type cart_status as enum ('active', 'converted', 'abandoned');
create type payment_provider as enum ('paystack', 'flutterwave');
create type sync_type as enum ('inventory', 'price', 'availability', 'product_import');
create type notification_channel as enum ('email', 'in_app');

-- ─────────────────────────────────────────────────────────────
-- Identity & localization
-- ─────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role user_role not null default 'customer',
  country_code text, -- set during post-signup onboarding, nullable until then
  currency_code text, -- display currency, derived from country_code but overridable
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text,
  full_name text not null,
  phone text,
  line1 text not null,
  line2 text,
  city text not null,
  state text,
  postal_code text,
  country_code text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_id_idx on addresses(user_id);

create table countries (
  code text primary key, -- ISO-3166 alpha-2
  name text not null,
  currency_code text not null,
  supported boolean not null default true,
  shipping_zone text
);

-- Display currency conversion only. Never used for settlement math —
-- settlement currency/amount comes from whichever payment provider
-- actually processed the charge (see payments.provider + payments.currency_code).
create table currency_rates (
  id uuid primary key default gen_random_uuid(),
  base_code text not null default 'USD',
  quote_code text not null,
  rate numeric(18, 8) not null,
  source text not null,
  fetched_at timestamptz not null default now(),
  unique (base_code, quote_code, fetched_at)
);
create index currency_rates_lookup_idx on currency_rates(base_code, quote_code, fetched_at desc);

-- ─────────────────────────────────────────────────────────────
-- Catalog
-- ─────────────────────────────────────────────────────────────
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null, -- 'cj', future: 'other_supplier'
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references categories(id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete set null,
  supplier_product_id text,
  title text not null,
  slug text not null unique,
  description text,
  short_description text,
  category_id uuid references categories(id) on delete set null,
  tags text[] not null default '{}',
  base_cost_cents int not null default 0, -- supplier cost, admin-only visibility
  selling_price_cents int not null default 0,
  compare_at_price_cents int,
  currency_code text not null default 'USD',
  weight_grams int,
  dimensions_json jsonb,
  status product_status not null default 'draft',
  is_featured boolean not null default false,
  is_bestseller boolean not null default false,
  is_new_arrival boolean not null default false,
  rating_avg numeric(2, 1) not null default 0,
  rating_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on products(category_id);
create index products_status_idx on products(status);
create index products_tags_idx on products using gin(tags);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  supplier_variant_id text,
  sku text not null,
  supplier_sku text,
  option_values_json jsonb not null default '{}', -- e.g. {"color":"Black","size":"M"}
  price_delta_cents int not null default 0,
  inventory_qty int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, sku)
);
create index product_variants_product_idx on product_variants(product_id);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order int not null default 0
);
create index product_images_product_idx on product_images(product_id);

create table product_destination_availability (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  country_code text not null,
  is_available boolean not null default false,
  shipping_cost_cents int,
  est_delivery_min_days int,
  est_delivery_max_days int,
  synced_at timestamptz not null default now(),
  unique (product_id, country_code)
);
create index pda_country_idx on product_destination_availability(country_code);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  order_item_id uuid, -- fk added after order_items exists, below
  rating int not null check (rating between 1 and 5),
  body text,
  status text not null default 'pending', -- pending | published | rejected
  created_at timestamptz not null default now()
);
create index reviews_product_idx on reviews(product_id);

create table supplier_sync_logs (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete set null,
  sync_type sync_type not null,
  status text not null, -- running | success | failed
  items_processed int not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- Cart / Wishlist
-- ─────────────────────────────────────────────────────────────
create table carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  session_token text, -- guest cart identifier, set via cookie
  country_code text,
  currency_code text,
  status cart_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_owner_check check (user_id is not null or session_token is not null)
);
create index carts_user_idx on carts(user_id);
create index carts_session_idx on carts(session_token);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  price_snapshot_cents int not null, -- re-validated server-side at checkout, never trusted alone
  created_at timestamptz not null default now()
);
create index cart_items_cart_idx on cart_items(cart_id);

create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (user_id, product_id, variant_id)
);
create index wishlist_items_user_idx on wishlist_items(user_id);

-- ─────────────────────────────────────────────────────────────
-- Orders / Payments / Fulfillment
-- ─────────────────────────────────────────────────────────────
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique, -- e.g. TUS-10294, generated server-side
  user_id uuid references profiles(id) on delete set null,
  email text not null,
  phone text,
  currency_code text not null, -- customer-facing display currency
  country_code text not null,
  -- amounts are stored in USD cents (base currency) for consistent accounting
  subtotal_cents int not null,
  shipping_cents int not null default 0,
  tax_cents int not null default 0,
  discount_cents int not null default 0,
  total_cents int not null,
  -- snapshot of the USD->display currency rate used, so historical orders
  -- never change when exchange_rates are refreshed later
  exchange_rate_snapshot numeric(18, 8) not null default 1,
  payment_status payment_status not null default 'pending',
  fulfillment_status fulfillment_status not null default 'unfulfilled',
  shipping_status shipping_status not null default 'pending',
  shipping_address_json jsonb not null,
  billing_address_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on orders(user_id);
create index orders_payment_status_idx on orders(payment_status);
create index orders_fulfillment_status_idx on orders(fulfillment_status);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  title_snapshot text not null,
  sku_snapshot text,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null,
  supplier_cost_cents int not null default 0 -- admin-only visibility, enforced by RLS
);
create index order_items_order_idx on order_items(order_id);

alter table reviews
  add constraint reviews_order_item_fk foreign key (order_item_id) references order_items(id) on delete set null;

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider payment_provider not null,
  provider_reference text not null, -- Paystack/Flutterwave transaction reference or id
  status text not null, -- provider-native status string, mapped to orders.payment_status by the service layer
  amount_cents int not null,
  currency_code text not null, -- the currency actually charged/settled, may differ from orders.currency_code display
  raw_event_json jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_reference)
);
create index payments_order_idx on payments(order_id);

create table supplier_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  supplier_order_id text,
  status text not null default 'pending', -- pending | submitted | confirmed | failed
  submitted_at timestamptz,
  confirmed_at timestamptz,
  last_error text,
  retry_count int not null default 0,
  created_at timestamptz not null default now()
);
create index supplier_orders_order_idx on supplier_orders(order_id);

create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  carrier text,
  tracking_number text,
  tracking_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index shipments_order_idx on shipments(order_id);

create table tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  status text not null,
  description text,
  occurred_at timestamptz not null,
  raw_source jsonb
);
create index tracking_events_shipment_idx on tracking_events(shipment_id);

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null, -- 'percent' | 'fixed'
  value numeric not null,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int,
  usage_count int not null default 0,
  is_active boolean not null default true
);

-- ─────────────────────────────────────────────────────────────
-- Tax (Section: configurable/extensible, not hard-coded worldwide rates)
-- ─────────────────────────────────────────────────────────────
create table tax_rules (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  region text, -- state/province, nullable for country-flat rules
  rate_percent numeric(5, 3) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_code, region)
);

-- ─────────────────────────────────────────────────────────────
-- Notifications / System / Admin
-- ─────────────────────────────────────────────────────────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null, -- order_confirmation | shipping_update | ...
  channel notification_channel not null default 'email',
  payload_json jsonb,
  sent_at timestamptz,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null, -- customer | admin | system
  actor_id uuid,
  event_type text not null, -- e.g. order.created, admin.price_changed
  entity_type text,
  entity_id uuid,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);
create index activity_logs_created_idx on activity_logs(created_at desc);
create index activity_logs_entity_idx on activity_logs(entity_type, entity_id);

create table admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null, -- paystack | flutterwave | cj
  event_id text not null, -- idempotency guard
  payload_json jsonb,
  processed_at timestamptz,
  status text not null default 'received',
  created_at timestamptz not null default now(),
  unique (source, event_id)
);

create table integration_logs (
  id uuid primary key default gen_random_uuid(),
  integration text not null, -- cj | paystack | flutterwave | exchange_rate | resend
  direction text not null, -- outbound | inbound
  status_code int,
  summary text,
  created_at timestamptz not null default now()
);

create table settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value_json jsonb not null,
  updated_at timestamptz not null default now()
);

-- updated_at helper
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array['profiles','addresses','products','product_variants','categories','carts','orders']
  loop
    execute format('create trigger set_updated_at before update on %I for each row execute function set_updated_at();', t);
  end loop;
end $$;
