-- The pass, in SQL. Every status change goes through advance_order() so the
-- state change, the audit row and the stock movement share one transaction —
-- a bare UPDATE from the client has nowhere to put the other two.

alter table orders
  add column started_at   timestamptz,
  add column collected_at timestamptz,
  add column claimed_by   uuid references staff(id) on delete set null;

-- ------------------------------------------------------------ the punch fix
-- card_punches() filtered `status <> 'cancelled'`. Without 'refunded' in that
-- list a refunded order keeps its punches and refunds mint free coffee. This
-- is the single highest-risk line in the whole feature.
create or replace function card_punches(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select 2
       + coalesce((select sum(oi.quantity)::integer
                     from order_items oi
                     join orders o on o.id = oi.order_id
                    where o.user_id = p_user
                      and o.status not in ('cancelled', 'refunded')
                      and oi.earns_punch), 0)
       - coalesce((select sum(cr.punches_spent)::integer
                     from card_redemptions cr
                    where cr.user_id = p_user), 0);
$$;

-- my_usual() reads the same history and must agree about what counts.
create or replace function my_usual()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select oi.menu_item_id,
           sum(oi.quantity) as total,
           max(o.placed_at) as last_at
      from order_items oi
      join orders o on o.id = oi.order_id
     where o.user_id = auth.uid()
       and o.status not in ('cancelled', 'refunded')
       and oi.menu_item_id is not null
     group by oi.menu_item_id
     order by total desc, last_at desc
     limit 1
  )
  select jsonb_build_object(
    'menu_item_id',  m.id,
    'name',          m.name,
    'base_price',    m.base_price,
    'daily_stock',   m.daily_stock,
    'image_url',     m.image_url,
    'times_ordered', r.total,
    'selected_modifiers', coalesce((
      select oi2.selected_modifiers
        from order_items oi2
        join orders o2 on o2.id = oi2.order_id
       where o2.user_id = auth.uid()
         and oi2.menu_item_id = m.id
       order by o2.placed_at desc
       limit 1), '[]'::jsonb)
  )
    from ranked r
    join menu_items m on m.id = r.menu_item_id;
$$;

-- -------------------------------------------------------------- transitions
-- Which permission each move needs. Anything absent from this function is not
-- a legal transition and advance_order() raises.
create function order_transition_action(p_from order_status, p_to order_status)
returns text
language sql
immutable
as $$
  select case
    when p_to = 'cancelled' and p_from in ('pending','paid','preparing','ready')
      then 'order.void'
    when p_to = 'refunded'  and p_from = 'collected'
      then 'order.refund'
    when (p_from, p_to) in (
      ('pending','paid'), ('paid','preparing'),
      ('preparing','ready'), ('ready','collected')
    ) then 'order.advance'
    -- One lane back. The 90-second window is applied by advance_order(), the
    -- only caller that knows how long ago the stamp was written.
    when (p_from, p_to) in (
      ('paid','pending'), ('preparing','paid'),
      ('ready','preparing'), ('collected','ready')
    ) then 'order.undo'
    else null
  end;
$$;

create function advance_order(
  p_order_id uuid,
  p_to       order_status,
  p_actor    uuid,
  p_station  uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  staff;
  v_order  orders;
  v_action text;
  v_stamp  timestamptz;
begin
  -- Read the actor fresh, never from a claim the caller handed us. This is
  -- what makes `is_active = false` kill a live cookie at the next write.
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'No such order.' using errcode = 'P0001';
  end if;

  v_action := order_transition_action(v_order.status, p_to);
  if v_action is null then
    raise exception 'Cannot move % to %.', v_order.status, p_to
      using errcode = 'P0001';
  end if;

  -- Stepping back is free for 90 seconds: "ready" gets pressed early all day,
  -- and a hard one-way machine just gets worked around with voids and
  -- re-rings, which is worse for the data than a logged undo.
  if v_action = 'order.undo' then
    v_stamp := case v_order.status
      when 'paid'      then v_order.placed_at
      when 'preparing' then v_order.started_at
      when 'ready'     then v_order.ready_at
      when 'collected' then v_order.collected_at
    end;

    if v_stamp is null or now() - v_stamp > interval '90 seconds' then
      v_action := 'order.undo_late';
    else
      v_action := 'order.advance';
    end if;
  end if;

  if not staff_can(v_actor.role, v_action) then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;

  -- A void hands the stock back. Aggregated, for the same reason
  -- release_order() aggregates: an `update … from order_items` applies only one
  -- join row per menu row and silently under-restores a two-line order.
  if p_to = 'cancelled' then
    update menu_items m
       set daily_stock = m.daily_stock + agg.qty
      from (select menu_item_id, sum(quantity)::integer as qty
              from order_items
             where order_id = p_order_id and menu_item_id is not null
             group by menu_item_id) agg
     where m.id = agg.menu_item_id and m.daily_stock is not null;
  end if;
  -- A refund deliberately does NOT restore stock: it was eaten.

  update orders
     set status       = p_to,
         started_at   = case when p_to = 'preparing' then now()
                             when p_to in ('pending','paid') then null
                             else started_at end,
         ready_at     = case when p_to = 'ready' then now()
                             when p_to in ('pending','paid','preparing') then null
                             else ready_at end,
         collected_at = case when p_to = 'collected' then now()
                             when p_to in ('pending','paid','preparing','ready')
                               then null
                             else collected_at end,
         claimed_by   = case when p_to = 'preparing' then p_actor
                             else claimed_by end
   where id = p_order_id;

  insert into staff_events (staff_id, station_id, action, subject_id, detail)
  values (p_actor, p_station, v_action, p_order_id,
          jsonb_build_object('from', v_order.status, 'to', p_to,
                             'total', v_order.total));

  return jsonb_build_object('id', p_order_id, 'status', p_to);
end;
$$;

-- -------------------------------------------------------------------- reads
-- One order, staff projection. Mirrors order_by_token()'s shape so the two
-- confirmation surfaces and the board never disagree about a field name.
-- access_token and the stripe_* columns stay out, exactly as they do there.
--
-- Contact details are deliberately absent: a barista does not need a phone
-- number to make a cortado. bar_name is the name called over the pass.
create function staff_order(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not exists (
      select 1 from staff s where s.user_id = auth.uid() and s.is_active
    ) then null
    else (
      select jsonb_build_object(
        'id',              o.id,
        'order_number',    o.order_number,
        'status',          o.status,
        'customer_name',   o.customer_name,
        'notes',           o.notes,
        'subtotal',        o.subtotal,
        'total',           o.total,
        'payment_method',  o.payment_method,
        'placed_at',       o.placed_at,
        'pickup_at',       o.pickup_at,
        'started_at',      o.started_at,
        'ready_at',        o.ready_at,
        'collected_at',    o.collected_at,
        'claimed_by',      (select display_name from staff where id = o.claimed_by),
        'bar_name',        p.bar_name,
        'avoid_allergens', coalesce(p.avoid_allergens, '{}'),
        'is_regular',      coalesce((select count(*) from orders o2
                                      where o2.user_id = o.user_id
                                        and o2.status = 'collected'), 0),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'item_name',          i.item_name,
                   'menu_item_id',       i.menu_item_id,
                   'quantity',           i.quantity,
                   'selected_modifiers', i.selected_modifiers,
                   'line_total',         i.line_total,
                   -- Flags a line whose item ran out after the order was paid.
                   'gone',               coalesce(m.daily_stock = 0, false)
                 ) order by i.created_at, i.id)
            from order_items i
            left join menu_items m on m.id = i.menu_item_id
           where i.order_id = o.id
        ), '[]'::jsonb)
      )
      from orders o
      left join profiles p on p.id = o.user_id
      where o.id = p_order_id
    )
  end;
$$;

-- The whole board in one call: everything unsettled, plus today's collected.
create function staff_board()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not exists (
      select 1 from staff s where s.user_id = auth.uid() and s.is_active
    ) then '[]'::jsonb
    else coalesce((
      select jsonb_agg(staff_order(o.id) order by o.placed_at)
        from orders o
       where o.status in ('pending','paid','preparing','ready')
          -- ponytail: Europe/Bucharest is hardcoded until shop settings ship.
          -- The day boundary is a shop fact, not a UTC one.
          or (o.status = 'collected'
              and o.collected_at >= (date_trunc('day',
                    now() at time zone 'Europe/Bucharest')
                    at time zone 'Europe/Bucharest'))
    ), '[]'::jsonb)
  end;
$$;

-- -------------------------------------------------------------------- stock
-- The only way the dashboard writes daily_stock. 0 is the 86 button; a number
-- is the morning bake count; null stays "unlimited", as the column already
-- means for espresso-bar drinks.
create function set_item_stock(
  p_item_id uuid,
  p_stock   integer,
  p_actor   uuid,
  p_station uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor staff;
  v_was   integer;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;

  if not staff_can(v_actor.role, 'item.86') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;

  if p_stock is not null and p_stock < 0 then
    raise exception 'Stock cannot be negative.' using errcode = 'P0001';
  end if;

  select daily_stock into v_was from menu_items where id = p_item_id;

  update menu_items set daily_stock = p_stock where id = p_item_id;

  insert into staff_events (staff_id, station_id, action, subject_id, detail)
  values (p_actor, p_station, 'item.86', p_item_id,
          jsonb_build_object('from', v_was, 'to', p_stock));

  return p_stock;
end;
$$;

-- ----------------------------------------------------------------- realtime
-- The board subscribes to `orders` only. order_items rows arrive in a separate
-- replication message from their parent insert, so subscribing to both renders
-- a card with no lines for a few hundred milliseconds on every new order.
-- Instead any event triggers a staff_board() re-fetch.
alter publication supabase_realtime add table orders;

revoke all on function advance_order(uuid, order_status, uuid, uuid) from public, anon;
revoke all on function set_item_stock(uuid, integer, uuid, uuid) from public, anon;
revoke all on function staff_order(uuid) from public, anon;
revoke all on function staff_board() from public, anon;
grant execute on function advance_order(uuid, order_status, uuid, uuid) to authenticated;
grant execute on function set_item_stock(uuid, integer, uuid, uuid) to authenticated;
grant execute on function staff_order(uuid) to authenticated;
grant execute on function staff_board() to authenticated;
