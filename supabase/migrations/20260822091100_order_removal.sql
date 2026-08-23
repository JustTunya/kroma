-- Taking an order off the pass, in the two ways it actually happens: nobody
-- came for it, or the customer never meant to place it.
--
-- Both already had a shape here — 'cancelled' and advance_order() — but both
-- were wrong in the same way: they moved the status and nothing else. A voided
-- card order kept the customer's money, and an uncollected one handed stock
-- back to the storefront that had already gone in the bin. This file fixes the
-- stock half in SQL and hands the money half to the one caller that can move
-- it, by saying so in the return value.

-- ------------------------------------------------------------------ who may
-- Marking a drink uncollected is not a money decision: the money stays exactly
-- where it is. The person locking up at six is the one who can see the tray,
-- so it sits with 'item.86' rather than with the void.
create or replace function staff_can(p_role staff_role, p_action text)
returns boolean
language sql
immutable
as $$
  select case p_action
    -- anyone on shift
    when 'order.view'       then true
    when 'order.advance'    then true
    when 'order.note'       then true
    when 'order.claim'      then true
    -- The person holding the empty tray is the one who knows. Making them find
    -- a manager means the storefront keeps selling something that is gone.
    when 'item.86'          then true
    -- Nothing moves: the drink was made and the customer paid for it. What a
    -- manager still owns is doing it EARLY, which advance_order() re-routes to
    -- 'order.void' inside the half hour.
    when 'order.abandon'    then true
    -- manager and owner
    when 'order.void'       then p_role in ('owner', 'manager')
    when 'order.refund'     then p_role in ('owner', 'manager')
    when 'order.discount'   then p_role in ('owner', 'manager')
    when 'order.undo_late'  then p_role in ('owner', 'manager')
    when 'customer.contact' then p_role in ('owner', 'manager')
    when 'menu.edit'        then p_role in ('owner', 'manager')
    when 'analytics.view'   then p_role in ('owner', 'manager')
    -- owner only
    when 'staff.manage'     then p_role = 'owner'
    when 'shop.settings'    then p_role = 'owner'
    else false
  end;
$$;

-- -------------------------------------------------------------- transitions
create or replace function order_transition_action(p_from order_status, p_to order_status)
returns text
language sql
immutable
as $$
  select case
    when p_to = 'cancelled' and p_from in ('pending','paid','preparing','ready')
      then 'order.void'
    when p_to = 'refunded'  and p_from = 'collected'
      then 'order.refund'
    -- Only from 'ready'. An order still being made has not been left by
    -- anyone; it is either finished or voided.
    when p_to = 'abandoned' and p_from = 'ready'
      then 'order.abandon'
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

create or replace function advance_order(
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
  v_refund boolean := false;
begin
  -- Read the actor fresh, never from a claim the caller handed us. This is
  -- what makes `is_active = false` kill a live cookie at the next write.
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;

  -- The row lock is also the refund guard: two taps on "void" serialise here,
  -- the second finds a settled order and raises, so the caller is handed
  -- refund_owed exactly once for one order.
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

  -- Half an hour on the bar is what lib/order-age.ts already calls stale, and
  -- what the row means when it says "nobody has come for it". Before that,
  -- writing off a paid order is a manager's call — the customer may well be
  -- walking through the door.
  if v_action = 'order.abandon'
     and (v_order.ready_at is null
          or now() - v_order.ready_at < interval '30 minutes') then
    v_action := 'order.void';
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
  -- A refund deliberately does NOT restore stock: it was eaten. Nor does an
  -- abandoned order: it was made, and it went in the bin.

  -- Whether the shop owes the money back. The rule lives here because it is a
  -- business rule; moving it is lib/refund.ts's job, because the stripe_*
  -- columns stay out of every projection and Postgres cannot call Stripe.
  if p_to in ('cancelled', 'refunded')
     and v_order.payment_method = 'online'
     and v_order.stripe_payment_intent_id is not null then
    v_refund := true;
  end if;

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

  return jsonb_build_object('id', p_order_id, 'status', p_to,
                            'refund_owed', v_refund);
end;
$$;

-- ------------------------------------------------------- the customer's own
-- "I ordered that by accident."
--
-- The window is the work, not a clock: while the order is still waiting on the
-- pass it costs the shop nothing to drop it, and the moment a barista presses
-- Start it is being made and the bin is not the customer's to fill. No timer,
-- no cron, no grace period to tune — the board already decides this.
--
-- The access token is the guest's only credential; order_by_token() already
-- treats it as one. It buys exactly this one order, and the return carries no
-- stripe_* column, in step with every other projection.
create function cancel_order_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
begin
  select * into v_order from orders where access_token = p_token for update;
  if v_order.id is null then
    raise exception 'No such order.' using errcode = 'P0001';
  end if;

  if v_order.status not in ('pending', 'paid') then
    raise exception 'Already on the bar — ask at the counter.'
      using errcode = 'P0001';
  end if;

  update orders
     set status = 'cancelled', expires_at = null
   where id = v_order.id;

  -- Aggregated, same reason as release_order() and advance_order().
  update menu_items m
     set daily_stock = m.daily_stock + agg.qty
    from (select menu_item_id, sum(quantity)::integer as qty
            from order_items
           where order_id = v_order.id and menu_item_id is not null
           group by menu_item_id) agg
   where m.id = agg.menu_item_id and m.daily_stock is not null;

  -- staff_id null: nobody on shift did this. The detail page already words a
  -- null actor as "System"; the action name says who it really was.
  insert into staff_events (staff_id, station_id, action, subject_id, detail)
  values (null, null, 'order.cancel_self', v_order.id,
          jsonb_build_object('from', v_order.status, 'to', 'cancelled',
                             'total', v_order.total));

  return jsonb_build_object(
    'id', v_order.id,
    'status', 'cancelled',
    'refund_owed', v_order.payment_method = 'online'
                   and v_order.stripe_payment_intent_id is not null);
end;
$$;

-- -------------------------------------------------------------- what counts
-- The punch fix, again. An order nobody collected must not mint loyalty: it
-- was never handed over, and "order it, never come" would otherwise be the
-- cheapest way to farm a free coffee. is_regular already counts only
-- 'collected'; these two now agree with it.
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
                      and o.status not in ('cancelled', 'refunded', 'abandoned')
                      and oi.earns_punch), 0)
       - coalesce((select sum(cr.punches_spent)::integer
                     from card_redemptions cr
                    where cr.user_id = p_user), 0);
$$;

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
       and o.status not in ('cancelled', 'refunded', 'abandoned')
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

-- The token is the credential, exactly as it is for order_by_token().
revoke all on function cancel_order_by_token(uuid) from public;
grant execute on function cancel_order_by_token(uuid) to anon, authenticated;
