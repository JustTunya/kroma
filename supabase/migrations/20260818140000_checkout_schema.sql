-- Checkout: order ownership, guest access token, payment route, stock hold.

alter table orders
  add column user_id                  uuid references auth.users (id) on delete set null,
  add column access_token             uuid not null default gen_random_uuid(),
  add column payment_method           text not null default 'counter'
    check (payment_method in ('online', 'counter')),
  add column pickup_at                timestamptz,
  -- Stock-hold deadline. Null for counter orders: they never expire.
  add column expires_at               timestamptz,
  add column stripe_session_id        text unique,
  add column stripe_payment_intent_id text;

-- The default exists only to satisfy `not null` on any pre-existing row.
-- Every insert from here on states the payment method explicitly.
alter table orders alter column payment_method drop default;

create unique index orders_access_token_idx on orders (access_token);
create index orders_user_idx   on orders (user_id, placed_at desc);
create index orders_expiry_idx on orders (expires_at) where status = 'pending';

-- Signed-in customers read their own orders. Guests get no policy at all —
-- their read goes through order_by_token(), added in a later migration.
-- Note `auth.uid() = user_id` is null (not true) for a guest row, so an
-- anonymous session matches nothing.
create policy "orders read own" on orders
  for select using (auth.uid() = user_id);

create policy "order items read own" on order_items
  for select using (
    exists (
      select 1
        from orders
       where orders.id = order_items.order_id
         and orders.user_id = auth.uid()
    )
  );
