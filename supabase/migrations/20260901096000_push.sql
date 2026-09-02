-- Web Push, scoped to one order rather than to a person. That is the whole
-- design decision: no preference screen, no unsubscribe flow, no endpoints
-- accumulating for a customer who has not visited since March. The row dies
-- with the order.
create table order_push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique (order_id, endpoint)
);

-- The token is the credential, as it is for every other guest-facing RPC here.
create function subscribe_order_push(
  p_token    uuid,
  p_endpoint text,
  p_p256dh   text,
  p_auth     text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order uuid;
begin
  select id into v_order from orders
   where access_token = p_token
     and status in ('pending','paid','preparing');
  if v_order is null then return false; end if;

  insert into order_push_subscriptions (order_id, endpoint, p256dh, auth)
  values (v_order, p_endpoint, p_p256dh, p_auth)
  on conflict (order_id, endpoint) do nothing;

  return true;
end;
$$;

alter table order_push_subscriptions enable row level security;
-- No policy at all: only the subscribe RPC writes, and only the service role
-- (lib/push.ts) reads, exactly as the stripe_* columns are handled.

grant execute on function subscribe_order_push(uuid, text, text, text) to anon, authenticated;
