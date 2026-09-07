-- 0004_order_idempotency.sql
-- Prevents duplicate orders from a repeated/retried checkout submission
-- (double-click, refresh, network retry). The client generates one key
-- per checkout page load and sends it with every placeOrder() attempt
-- from that load; the server treats a repeat of the same key as "this
-- attempt already happened" rather than creating a second order.

alter table orders add column idempotency_key text;
create unique index orders_idempotency_key_idx on orders (idempotency_key) where idempotency_key is not null;
