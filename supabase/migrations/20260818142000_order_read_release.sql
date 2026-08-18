-- Guests have no RLS policy on orders. This is their one way in: an
-- unguessable token buys exactly one order, projected to the fields the
-- confirmation page needs. access_token, user_id and the stripe_* columns are
-- deliberately absent from the projection.
create function order_by_token(p_token uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id',             o.id,
    'order_number',   o.order_number,
    'status',         o.status,
    'customer_name',  o.customer_name,
    'notes',          o.notes,
    'subtotal',       o.subtotal,
    'total',          o.total,
    'payment_method', o.payment_method,
    'placed_at',      o.placed_at,
    'pickup_at',      o.pickup_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item_name',          i.item_name,
               'base_price',         i.base_price,
               'quantity',           i.quantity,
               'selected_modifiers', i.selected_modifiers,
               'line_total',         i.line_total
             ) order by i.created_at, i.id)
        from order_items i
       where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from orders o
  where o.access_token = p_token;
$$;

-- Cancels a pending order and hands its stock back. Guarded by
-- `status = 'pending'`, which IS the webhook idempotency: replaying
-- checkout.session.expired is a no-op, so no event ledger is needed.
create function release_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update orders
     set status = 'cancelled', expires_at = null
   where id = p_order_id
     and status = 'pending';

  if not found then
    return false;
  end if;

  -- Aggregated on purpose. An `update … from order_items` would apply only one
  -- join row per menu_items row, silently under-restoring an order that has the
  -- same item on two lines.
  update menu_items m
     set daily_stock = m.daily_stock + agg.qty
    from (
      select menu_item_id, sum(quantity)::integer as qty
        from order_items
       where order_id = p_order_id
         and menu_item_id is not null
       group by menu_item_id
    ) agg
   where m.id = agg.menu_item_id
     and m.daily_stock is not null;

  return true;
end;
$$;

-- Backstop for a checkout.session.expired webhook that never arrived. Without
-- it, one dropped event locks that stock until closing.
create function release_expired_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_count integer := 0;
begin
  for v_id in
    select id
      from orders
     where status = 'pending'
       and payment_method = 'online'
       and expires_at is not null
       and expires_at < now()
     for update skip locked
  loop
    if release_order(v_id) then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function order_by_token(uuid) from public;
grant execute on function order_by_token(uuid) to anon, authenticated;

-- Release is a privileged operation: only the webhook and the cron route.
revoke all on function release_order(uuid) from public, anon, authenticated;
revoke all on function release_expired_orders() from public, anon, authenticated;
grant execute on function release_order(uuid) to service_role;
grant execute on function release_expired_orders() to service_role;
