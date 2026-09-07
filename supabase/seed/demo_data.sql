-- ═══════════════════════════════════════════════════════════════
-- DEMO DATA — for local development only. Do NOT run against
-- production. Nothing here is real inventory, pricing, or business
-- data — every row is placeholder content so the storefront has
-- something to render before CJ product import (Phase 9) is live.
-- See Section 60 of the architecture plan: this must never be
-- presented to customers or counted in real analytics.
-- ═══════════════════════════════════════════════════════════════

insert into countries (code, name, currency_code, supported) values
  ('US', 'United States', 'USD', true),
  ('NG', 'Nigeria', 'NGN', true),
  ('DE', 'Germany', 'EUR', true),
  ('FR', 'France', 'EUR', true),
  ('IE', 'Ireland', 'EUR', true),
  ('ES', 'Spain', 'EUR', true),
  ('IT', 'Italy', 'EUR', true)
on conflict (code) do nothing;

insert into categories (name, slug, sort_order) values
  ('New Arrivals', 'new-arrivals', 1),
  ('Fashion', 'fashion', 2),
  ('Jewelry & Accessories', 'jewelry-accessories', 3),
  ('Beauty & Personal Care', 'beauty-personal-care', 4),
  ('Electronics & Gadgets', 'electronics-gadgets', 5),
  ('Home & Living', 'home-living', 6),
  ('Sports & Fitness', 'sports-fitness', 7),
  ('Travel & Lifestyle', 'travel-lifestyle', 8)
on conflict (slug) do nothing;

insert into suppliers (name, type, is_active) values
  ('CJdropshipping', 'cj', true)
on conflict do nothing;

insert into settings (key, value_json) values
  ('homepage_content', '{"tagline": "ONE STORE. EVERYTHING YOU NEED.", "demo": true}')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Demo products — enough to exercise PLP/PDP/cart/wishlist/destination
-- availability locally. Titles are prefixed "[DEMO]" and tagged so they
-- are unmistakable in every list view; delete this block entirely before
-- ever pointing the app at a production Supabase project.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  v_fashion_id uuid;
  v_electronics_id uuid;
  v_hoodie_id uuid;
  v_headphones_id uuid;
  v_hoodie_variant_m uuid;
begin
  -- Guard the whole block so re-running this seed file locally doesn't
  -- fail on the products.slug unique constraint.
  if exists (select 1 from products where slug = 'demo-heavyweight-pullover-hoodie') then
    return;
  end if;

  select id into v_fashion_id from categories where slug = 'fashion';
  select id into v_electronics_id from categories where slug = 'electronics-gadgets';

  insert into products (
    title, slug, description, short_description, category_id, tags,
    base_cost_cents, selling_price_cents, compare_at_price_cents, currency_code,
    status, is_featured, is_bestseller, is_new_arrival, rating_avg, rating_count
  ) values (
    '[DEMO] Heavyweight Pullover Hoodie',
    'demo-heavyweight-pullover-hoodie',
    'DEMO DATA — not a real product. Heavyweight cotton-blend hoodie, brushed fleece interior.',
    'DEMO DATA — heavyweight cotton-blend hoodie.',
    v_fashion_id,
    array['demo', 'hoodie', 'fashion'],
    1500, 3999, 4999, 'USD',
    'active', true, true, true, 4.5, 12
  ) returning id into v_hoodie_id;

  insert into product_variants (product_id, sku, option_values_json, price_delta_cents, inventory_qty, is_active) values
    (v_hoodie_id, 'DEMO-HOODIE-M', '{"size":"M"}', 0, 25, true),
    (v_hoodie_id, 'DEMO-HOODIE-L', '{"size":"L"}', 0, 0, true);

  insert into product_images (product_id, url, alt_text, sort_order) values
    (v_hoodie_id, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800', 'Demo hoodie front', 0),
    (v_hoodie_id, 'https://images.unsplash.com/photo-1611312449408-fcece27cdbb7?w=800', 'Demo hoodie detail', 1);

  insert into product_destination_availability (product_id, country_code, is_available, shipping_cost_cents, est_delivery_min_days, est_delivery_max_days) values
    (v_hoodie_id, 'US', true, 699, 7, 12),
    (v_hoodie_id, 'DE', true, 999, 9, 15),
    (v_hoodie_id, 'FR', true, 999, 9, 15)
    -- Intentionally no row for NG — demonstrates the honest "can't ship
    -- to your destination" state rather than assuming worldwide coverage.
  ;

  insert into products (
    title, slug, description, short_description, category_id, tags,
    base_cost_cents, selling_price_cents, compare_at_price_cents, currency_code,
    status, is_featured, is_bestseller, is_new_arrival, rating_avg, rating_count
  ) values (
    '[DEMO] Wireless Over-Ear Headphones',
    'demo-wireless-over-ear-headphones',
    'DEMO DATA — not a real product. Active noise cancelling, 30-hour battery.',
    'DEMO DATA — wireless ANC headphones.',
    v_electronics_id,
    array['demo', 'electronics', 'audio'],
    2200, 5999, null, 'USD',
    'active', true, false, false, 4.2, 5
  ) returning id into v_headphones_id;

  insert into product_images (product_id, url, alt_text, sort_order) values
    (v_headphones_id, 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800', 'Demo headphones', 0);

  insert into product_destination_availability (product_id, country_code, is_available, shipping_cost_cents, est_delivery_min_days, est_delivery_max_days) values
    (v_headphones_id, 'US', true, 499, 5, 9),
    (v_headphones_id, 'DE', true, 799, 8, 14),
    (v_headphones_id, 'FR', true, 799, 8, 14),
    (v_headphones_id, 'NG', true, 1899, 14, 25);
end $$;

-- Demo tax rule — US-only flat rate so checkout has something real to
-- calculate. No row for other countries is intentional: the tax service
-- returns 0 rather than guessing when nothing is configured.
-- (Using NOT EXISTS rather than ON CONFLICT here: Postgres unique
-- constraints don't dedupe NULL region values, so ON CONFLICT wouldn't
-- reliably guard against re-running this seed.)
insert into tax_rules (country_code, region, rate_percent, is_active)
select 'US', null, 7.25, true
where not exists (
  select 1 from tax_rules where country_code = 'US' and region is null
);
