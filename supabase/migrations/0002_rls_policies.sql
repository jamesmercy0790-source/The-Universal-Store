-- 0002_rls_policies.sql
-- Enables RLS on every table with user-owned or admin-only data, and adds
-- policies. A security-definer helper checks admin role without recursive
-- RLS lookups on profiles.

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'support', 'order_manager')
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────
alter table profiles enable row level security;

create policy "profiles_select_own_or_admin" on profiles
  for select using (auth.uid() = id or is_admin());

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- addresses
-- ─────────────────────────────────────────────────────────────
alter table addresses enable row level security;

create policy "addresses_owner_all" on addresses
  for all using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- ─────────────────────────────────────────────────────────────
-- catalog: public read, admin write
-- ─────────────────────────────────────────────────────────────
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_images enable row level security;
alter table categories enable row level security;
alter table product_destination_availability enable row level security;

create policy "products_public_read_active" on products
  for select using (status = 'active' or is_admin());
create policy "products_admin_write" on products
  for insert with check (is_admin());
create policy "products_admin_update" on products
  for update using (is_admin());
create policy "products_admin_delete" on products
  for delete using (is_admin());

create policy "variants_public_read" on product_variants
  for select using (is_active or is_admin());
create policy "variants_admin_write" on product_variants
  for all using (is_admin()) with check (is_admin());

create policy "images_public_read" on product_images
  for select using (true);
create policy "images_admin_write" on product_images
  for all using (is_admin()) with check (is_admin());

create policy "categories_public_read" on categories
  for select using (is_active or is_admin());
create policy "categories_admin_write" on categories
  for all using (is_admin()) with check (is_admin());

create policy "availability_public_read" on product_destination_availability
  for select using (true);
create policy "availability_admin_write" on product_destination_availability
  for all using (is_admin()) with check (is_admin());

-- ─────────────────────────────────────────────────────────────
-- reviews: public read of published, owner writes own, admin moderates
-- ─────────────────────────────────────────────────────────────
alter table reviews enable row level security;

create policy "reviews_public_read_published" on reviews
  for select using (status = 'published' or user_id = auth.uid() or is_admin());
create policy "reviews_owner_insert" on reviews
  for insert with check (auth.uid() = user_id);
create policy "reviews_admin_moderate" on reviews
  for update using (is_admin());

-- ─────────────────────────────────────────────────────────────
-- cart / wishlist: owner-only (guest carts are matched by session_token
-- at the application layer using the service-role client, not RLS,
-- since there is no auth.uid() for a guest)
-- ─────────────────────────────────────────────────────────────
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table wishlist_items enable row level security;

create policy "carts_owner_all" on carts
  for all using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

create policy "cart_items_owner_all" on cart_items
  for all using (
    exists (select 1 from carts c where c.id = cart_id and (c.user_id = auth.uid() or is_admin()))
  )
  with check (
    exists (select 1 from carts c where c.id = cart_id and (c.user_id = auth.uid() or is_admin()))
  );

create policy "wishlist_owner_all" on wishlist_items
  for all using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- ─────────────────────────────────────────────────────────────
-- orders / order_items / payments / fulfillment: strict owner isolation
-- ─────────────────────────────────────────────────────────────
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table supplier_orders enable row level security;
alter table shipments enable row level security;
alter table tracking_events enable row level security;

create policy "orders_owner_read" on orders
  for select using (auth.uid() = user_id or is_admin());
-- Inserts/updates to orders happen only via server-side service-role calls
-- (checkout, webhooks) — no direct client insert/update policy is granted.

create policy "order_items_owner_read" on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_admin()))
  );

create policy "payments_admin_only" on payments
  for select using (is_admin());

create policy "supplier_orders_admin_only" on supplier_orders
  for select using (is_admin());

create policy "shipments_owner_read" on shipments
  for select using (
    exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_admin()))
  );

create policy "tracking_events_owner_read" on tracking_events
  for select using (
    exists (
      select 1 from shipments s join orders o on o.id = s.order_id
      where s.id = shipment_id and (o.user_id = auth.uid() or is_admin())
    )
  );

-- ─────────────────────────────────────────────────────────────
-- notifications: owner read
-- ─────────────────────────────────────────────────────────────
alter table notifications enable row level security;
create policy "notifications_owner_read" on notifications
  for select using (auth.uid() = user_id or is_admin());

-- ─────────────────────────────────────────────────────────────
-- admin-only system tables: no client access at all, service-role only
-- ─────────────────────────────────────────────────────────────
alter table activity_logs enable row level security;
alter table admin_notifications enable row level security;
alter table webhook_events enable row level security;
alter table integration_logs enable row level security;
alter table settings enable row level security;
alter table supplier_sync_logs enable row level security;
alter table tax_rules enable row level security;

create policy "activity_logs_admin_read" on activity_logs for select using (is_admin());
create policy "admin_notifications_admin_read" on admin_notifications for select using (is_admin());
create policy "webhook_events_admin_read" on webhook_events for select using (is_admin());
create policy "integration_logs_admin_read" on integration_logs for select using (is_admin());
create policy "settings_public_read" on settings for select using (true); -- homepage content etc. is public-readable
create policy "settings_admin_write" on settings for all using (is_admin()) with check (is_admin());
create policy "sync_logs_admin_read" on supplier_sync_logs for select using (is_admin());
create policy "tax_rules_admin_all" on tax_rules for all using (is_admin()) with check (is_admin());

-- countries / currency_rates: public read, admin write (no user-owned rows)
alter table countries enable row level security;
alter table currency_rates enable row level security;
create policy "countries_public_read" on countries for select using (true);
create policy "countries_admin_write" on countries for all using (is_admin()) with check (is_admin());
create policy "rates_public_read" on currency_rates for select using (true);
create policy "rates_admin_write" on currency_rates for all using (is_admin()) with check (is_admin());

alter table coupons enable row level security;
create policy "coupons_public_read_active" on coupons for select using (is_active or is_admin());
create policy "coupons_admin_write" on coupons for all using (is_admin()) with check (is_admin());
