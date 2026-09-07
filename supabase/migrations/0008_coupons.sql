-- 0008_coupons.sql
-- Completes the coupons table (Section 12) with a minimum-order-amount
-- threshold, and links orders back to the coupon actually used so usage
-- counts can be incremented atomically and audited.
--
-- RLS on `coupons` (public-read-active, admin-write) was already set up
-- in 0002_rls_policies.sql — nothing further needed here.

alter table coupons add column min_order_amount_cents int not null default 0;
alter table orders add column coupon_id uuid references coupons(id) on delete set null;
