-- How the money actually arrived.
--
-- payment_method answers WHERE (online / counter) and cannot answer WHAT (cash
-- / card). Without the second the drawer cannot be counted, which means till
-- errors and theft are structurally invisible. This is the column the whole
-- Z-report stands on.
alter table orders
  add column settled_as text check (settled_as in ('cash','card','online'));

update orders set settled_as = 'online'
 where payment_method = 'online'
   and status not in ('pending','cancelled');

create index orders_settled_idx on orders (service_day, settled_as);

-- service_report() (Task 11, this same migration) sums discount_total before
-- Phase F exists to populate it. Landing the column here — Phase F adds only
-- discount_reason and the discount_order() RPC — keeps that function correct
-- from the day it is written instead of waiting on a migration two phases away.
alter table orders
  add column discount_total numeric(8,2) not null default 0 check (discount_total >= 0);

-- The 4-arg signature gains a 5th parameter here, which Postgres treats as a
-- new overload rather than a replacement — drop it first or both signatures
-- resolve ambiguously for any 3-arg call.
drop function if exists advance_order(uuid, order_status, uuid, uuid);

-- Copied verbatim from 20260822091100_order_removal.sql:77, with the tender
-- guard inserted after the permission check and settled_as added to the update.
create or replace function advance_order(
  p_order_id uuid,
  p_to       order_status,
  p_actor    uuid,
  p_station  uuid default null,
  p_tender   text default null
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

  if v_action = 'order.abandon'
     and (v_order.ready_at is null
          or now() - v_order.ready_at < interval '30 minutes') then
    v_action := 'order.void';
  end if;

  if not staff_can(v_actor.role, v_action) then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;

  -- The one moment the shop learns how it was paid: a barista taking money at
  -- the counter. Asking later is asking someone to remember.
  if v_order.payment_method = 'counter' and v_order.status = 'pending' and p_to = 'paid' then
    -- `p_tender not in (...)` is NULL, not TRUE, when p_tender is null — the
    -- `is null or` is load-bearing, not decorative.
    if p_tender is null or p_tender not in ('cash', 'card') then
      raise exception 'Cash or card?' using errcode = 'P0001';
    end if;
  end if;

  if p_to = 'cancelled' then
    update menu_items m
       set daily_stock = m.daily_stock + agg.qty
      from (select menu_item_id, sum(quantity)::integer as qty
              from order_items
             where order_id = p_order_id and menu_item_id is not null
             group by menu_item_id) agg
     where m.id = agg.menu_item_id and m.daily_stock is not null;
  end if;

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
                             else claimed_by end,
         settled_as   = case
                          when p_to = 'paid' and v_order.payment_method = 'counter'
                            then p_tender
                          when p_to = 'pending' then null
                          else settled_as end
   where id = p_order_id;

  insert into staff_events (staff_id, station_id, action, subject_id, detail)
  values (p_actor, p_station, v_action, p_order_id,
          jsonb_build_object('from', v_order.status, 'to', p_to,
                             'total', v_order.total, 'tender', p_tender));

  return jsonb_build_object('id', p_order_id, 'status', p_to,
                            'refund_owed', v_refund);
end;
$$;

-- The day's takings, in one object.
--
-- Readable by anyone who may close (manager and owner). Deliberately callable
-- BEFORE the close too, so /dashboard/day and the count screen render the same
-- numbers the close will freeze — a report that only exists after the fact
-- cannot be checked against the drawer while the drawer is open.
create function service_report(p_actor uuid, p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor staff;
  v_day   service_days;
  v_out   jsonb;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;
  if not staff_can(v_actor.role, 'shop.close') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;

  select * into v_day from service_days where day = p_day;
  if v_day.day is null then
    raise exception 'No such day.' using errcode = 'P0001';
  end if;

  with scoped as (
    select * from orders where service_day = p_day
  ),
  kept as (
    -- order_was_paid() already encodes which statuses the shop keeps the money
    -- for, abandoned included. One definition, two pages.
    select * from scoped where order_was_paid(status)
  )
  select jsonb_build_object(
    'day',            p_day,
    'opened_at',      v_day.opened_at,
    'closed_at',      v_day.closed_at,
    'float',          v_day.float_cash,
    'orders',         (select count(*) from kept),
    'taken',          coalesce((select sum(total) from kept), 0),
    'net',            coalesce((select sum(total - tax_total) from kept), 0),
    'vat',            coalesce((select sum(tax_total) from kept), 0),
    'cash',           coalesce((select sum(total) from kept where settled_as = 'cash'), 0),
    'card',           coalesce((select sum(total) from kept where settled_as = 'card'), 0),
    'online',         coalesce((select sum(total) from kept where settled_as = 'online'), 0),
    'discounted',     coalesce((select sum(discount_total) from kept), 0),
    'voided',         coalesce((select sum(total) from scoped where status = 'cancelled'), 0),
    'refunded',       coalesce((select sum(total) from scoped where status = 'refunded'), 0),
    'binned',         coalesce((select sum(total) from scoped where status = 'abandoned'), 0),
    -- Cash out of the drawer: a refunded cash order was handed back in notes.
    'cash_refunded',  coalesce((select sum(total) from scoped
                                 where status = 'refunded' and settled_as = 'cash'), 0),
    'left', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'left', daily_stock)
                               order by name)
                        from menu_items
                       where daily_stock > 0 and is_active), '[]'::jsonb),
    'live', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'number', day_number)
                               order by day_number)
                        from scoped
                       where status in ('pending','paid','preparing','ready')), '[]'::jsonb)
  ) into v_out;

  return v_out || jsonb_build_object(
    'expected_cash', round((v_out ->> 'float')::numeric
                         + (v_out ->> 'cash')::numeric
                         - (v_out ->> 'cash_refunded')::numeric, 2));
end;
$$;

-- Shutting the day. The refusal is the feature: you cannot close a till over an
-- order nobody has resolved, and naming the tickets is what lets the close
-- screen link straight to them instead of leaving a disabled button.
create function close_service(p_actor uuid, p_counted numeric, p_detail jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  staff;
  v_day    date;
  v_report jsonb;
  v_live   jsonb;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;
  if not staff_can(v_actor.role, 'shop.close') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;

  v_day := current_service_day();
  if v_day is null then
    raise exception 'Nothing is open.' using errcode = 'P0001';
  end if;

  -- The lock also settles a double-tap: the second caller finds closed_at set.
  perform 1 from service_days where day = v_day for update;

  v_report := service_report(p_actor, v_day);
  v_live   := v_report -> 'live';

  if jsonb_array_length(v_live) > 0 then
    raise exception 'Still on the pass: %.',
      (select string_agg('#' || lpad((o ->> 'number'), 3, '0'), ' / ')
         from jsonb_array_elements(v_live) as t(o))
      using errcode = 'P0001';
  end if;

  if p_counted is null or p_counted < 0 then
    raise exception 'Count the drawer first.' using errcode = 'P0001';
  end if;

  v_report := v_report || jsonb_build_object(
    'counted',  round(p_counted, 2),
    'variance', round(p_counted - (v_report ->> 'expected_cash')::numeric, 2));

  update service_days
     set closed_at    = now(),
         closed_by    = p_actor,
         counted_cash = round(p_counted, 2),
         count_detail = p_detail,
         report       = v_report
   where day = v_day;

  insert into staff_events (staff_id, action, subject_id, detail)
  values (p_actor, 'shop.close', null, v_report);

  return v_report;
end;
$$;

revoke all on function service_report(uuid, date) from public, anon;
revoke all on function close_service(uuid, numeric, jsonb) from public, anon;
grant execute on function service_report(uuid, date) to authenticated;
grant execute on function close_service(uuid, numeric, jsonb) to authenticated;

-- create_order() never wrote settled_as: only advance_order() did, and an
-- online order is created already 'paid' — it never passes through
-- advance_order()'s pending→paid branch, so it would sit unsettled until
-- backfilled by hand. Copied from 20260901091000_vat.sql:236, with settled_as
-- added to the insert.
create or replace function create_order(
  p_items                    jsonb,
  p_customer_name            text,
  p_notes                    text,
  p_payment_method           text,
  p_user_id                  uuid default null,
  p_stripe_session_id        text default null,
  p_stripe_payment_intent_id text default null,
  p_redeem_item_id           uuid default null
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order         orders;
  v_lines         jsonb;
  v_subtotal      numeric(8,2);
  v_tax           numeric(8,2);
  v_user          uuid;
  v_redeem        uuid := null;
  v_redeemed_line jsonb;
  v_day           date;
  v_number        integer;
begin
  if p_payment_method not in ('online', 'counter') then
    raise exception 'Unknown payment method.' using errcode = 'P0001';
  end if;

  v_day := current_service_day();
  if v_day is null then
    raise exception 'The bakehouse is closed.' using errcode = 'P0001';
  end if;

  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
     = 'service_role' then
    v_user := p_user_id;
  elsif p_payment_method = 'online' then
    raise exception 'Card orders are placed once the payment clears.'
      using errcode = 'P0001';
  else
    v_user := auth.uid();
  end if;

  if p_redeem_item_id is not null then
    if v_user is null then
      raise exception 'The card belongs to an account.' using errcode = 'P0001';
    end if;

    perform pg_advisory_xact_lock(hashtext(v_user::text));

    if card_punches(v_user) >= 12 then
      v_redeem := p_redeem_item_id;
    else
      -- ponytail: accepted loss, unchanged from the card migration. Two
      -- concurrent checkouts on one full card both reach here; the second finds
      -- it spent and the order stands at full price.
      raise warning 'card already spent for % — order placed undiscounted', v_user;
    end if;
  end if;

  v_lines    := order_lines(p_items, true, v_redeem);
  v_subtotal := coalesce((select sum((l ->> 'line_total')::numeric)
                            from jsonb_array_elements(v_lines) as t(l)), 0);
  v_tax      := coalesce((select sum(vat_of((l ->> 'line_total')::numeric,
                                             (l ->> 'vat_rate')::numeric))
                            from jsonb_array_elements(v_lines) as t(l)), 0);

  update menu_items m
     set daily_stock = m.daily_stock - agg.qty
    from (
      select (l ->> 'menu_item_id')::uuid as id,
             sum((l ->> 'quantity')::integer) as qty
        from jsonb_array_elements(v_lines) as t(l)
       group by 1
    ) agg
   where m.id = agg.id
     and m.daily_stock is not null;

  update service_days
     set next_number = next_number + 1
   where day = v_day
  returning next_number - 1 into v_number;

  insert into orders (user_id, status, customer_name, notes, subtotal, total,
                      tax_total, settled_as, payment_method, pickup_at,
                      stripe_session_id, stripe_payment_intent_id,
                      service_day, day_number)
  values (v_user,
          case when p_payment_method = 'online' then 'paid' else 'pending' end::order_status,
          nullif(btrim(left(coalesce(p_customer_name, ''), 80)), ''),
          nullif(btrim(left(coalesce(p_notes, ''), 280)), ''),
          v_subtotal,
          v_subtotal,
          v_tax,
          case when p_payment_method = 'online' then 'online' else null end,
          p_payment_method,
          now() + interval '10 minutes',
          p_stripe_session_id,
          p_stripe_payment_intent_id,
          v_day,
          v_number)
  returning * into v_order;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, selected_modifiers, line_total, earns_punch,
                           vat_rate)
  select v_order.id,
         (l ->> 'menu_item_id')::uuid,
         l ->> 'item_name',
         (l ->> 'base_price')::numeric,
         (l ->> 'quantity')::smallint,
         l -> 'selected_modifiers',
         (l ->> 'line_total')::numeric,
         (l ->> 'earns_punch')::boolean,
         (l ->> 'vat_rate')::numeric
    from jsonb_array_elements(v_lines) as t(l);

  if v_redeem is not null then
    select value into v_redeemed_line
      from jsonb_array_elements(v_lines) as t(value)
     where (value ->> 'menu_item_id')::uuid = v_redeem;

    insert into card_redemptions (user_id, order_id, item_name)
    values (v_user, v_order.id, v_redeemed_line ->> 'item_name');
  end if;

  return v_order;
end;
$$;

-- staff_order() gains settled_as, alongside tax_total (Task 8). Verbatim
-- otherwise, from 20260901091000_vat.sql.
create or replace function staff_order(p_order_id uuid)
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
        'day_number',      o.day_number,
        'status',          o.status,
        'customer_name',   o.customer_name,
        'notes',           o.notes,
        'subtotal',        o.subtotal,
        'total',           o.total,
        'tax_total',       o.tax_total,
        'settled_as',      o.settled_as,
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
