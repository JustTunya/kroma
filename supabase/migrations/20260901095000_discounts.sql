-- Comps and discounts. Both discount_total and discount_reason already exist
-- on the orders table — discount_total landed in the tender migration so
-- service_report() had something real to sum from day one, and
-- discount_reason landed in the receipts migration so order_receipt() could
-- read it. This migration is the only place that actually WRITES either.

create function discount_order(
  p_order_id uuid,
  p_actor    uuid,
  p_kind     text,
  p_value    numeric,
  p_reason   text,
  p_station  uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  staff;
  v_order  orders;
  v_amount numeric(8,2);
  v_reason text;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;
  if not staff_can(v_actor.role, 'order.discount') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'No such order.' using errcode = 'P0001';
  end if;
  if v_order.status in ('cancelled', 'refunded') then
    raise exception 'That order is already settled.' using errcode = 'P0001';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if length(v_reason) < 3 then
    raise exception 'A reason, so the ledger means something.' using errcode = 'P0001';
  end if;

  v_amount := round(case p_kind
    when 'percent' then v_order.subtotal * least(greatest(p_value, 0), 100) / 100
    when 'amount'  then least(greatest(p_value, 0), v_order.subtotal)
    when 'comp'    then v_order.subtotal
    else null end, 2);

  if v_amount is null then
    raise exception 'Unknown discount.' using errcode = 'P0001';
  end if;

  update orders
     set discount_total = v_amount,
         discount_reason = v_reason,
         total = v_order.subtotal - v_amount,
         -- The tax follows the money down. Prorating the order's total rather
         -- than re-deriving per line is deliberate: a discount is not
         -- attributable to a line, and splitting it across mixed rates would
         -- be inventing a fact.
         -- ponytail: exact per-line apportionment if the shop ever sells at
         -- two rates in one order.
         tax_total = round(v_order.tax_total
                           * case when v_order.subtotal = 0 then 0
                                  else (v_order.subtotal - v_amount) / v_order.subtotal end, 2)
   where id = p_order_id;

  insert into staff_events (staff_id, station_id, action, subject_id, detail)
  values (p_actor, p_station, 'order.discount', p_order_id,
          jsonb_build_object('kind', p_kind, 'value', p_value, 'amount', v_amount,
                             'reason', v_reason, 'previous_discount', v_order.discount_total));

  return jsonb_build_object(
    'total', v_order.subtotal - v_amount,
    'discount_total', v_amount,
    -- Money already taken has to go back. The same shape advance_order()
    -- returns for a void, so the same caller handles it the same way.
    'refund_owed', case
      when v_order.status <> 'pending'
       and v_order.payment_method = 'online'
       and v_order.stripe_payment_intent_id is not null
      then v_amount - coalesce(v_order.discount_total, 0)
      else 0 end);
end;
$$;

revoke all on function discount_order(uuid, uuid, text, numeric, text, uuid) from public, anon;
grant execute on function discount_order(uuid, uuid, text, numeric, text, uuid) to authenticated;

-- staff_order() projects discount_total and discount_reason, so the board can
-- draw the "Comped / SPILLED IT" line. Verbatim otherwise, from
-- 20260901092000_tender_and_close.sql.
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
        'discount_total',  o.discount_total,
        'discount_reason', o.discount_reason,
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
