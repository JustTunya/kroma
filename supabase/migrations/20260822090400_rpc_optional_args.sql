-- Nullable arguments get SQL defaults, so the generated TypeScript marks them
-- optional instead of `string`.
--
-- `supabase gen types` does not model argument nullability: it emitted
-- `p_station: string` for a uuid that is legitimately null (a manager acting
-- from their phone is at no station), which made every call site a type error.
-- create_order() already solves this the same way for p_redeem_item_id.
--
-- Postgres requires defaulted parameters last, so set_item_stock's arguments
-- are reordered. Omitting p_stock now means "unlimited", which is exactly what
-- a null daily_stock already means for espresso-bar drinks.

drop function advance_order(uuid, order_status, uuid, uuid);
drop function set_item_stock(uuid, integer, uuid, uuid);
drop function note_order(uuid, text, uuid, uuid);

create function advance_order(
  p_order_id uuid,
  p_to       order_status,
  p_actor    uuid,
  p_station  uuid default null
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

create function set_item_stock(
  p_item_id uuid,
  p_actor   uuid,
  p_stock   integer default null,
  p_station uuid default null
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

  if not found then
    raise exception 'No such item.' using errcode = 'P0001';
  end if;

  insert into staff_events (staff_id, station_id, action, subject_id, detail)
  values (p_actor, p_station, 'item.86', p_item_id,
          jsonb_build_object('from', v_was, 'to', p_stock));

  return p_stock;
end;
$$;

create function note_order(
  p_order_id uuid,
  p_note     text,
  p_actor    uuid,
  p_station  uuid default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor staff;
  v_note  text := btrim(p_note);
  v_line  text;
  v_notes text;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;

  if not staff_can(v_actor.role, 'order.note') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;

  if v_note = '' then
    raise exception 'Nothing to add.' using errcode = 'P0001';
  end if;

  if length(v_note) > 280 then
    raise exception 'Keep it under 280.' using errcode = 'P0001';
  end if;

  -- Who said it travels with what was said: a note on the pass is only useful
  -- if the next person knows who to ask about it.
  v_line := v_actor.display_name || ': ' || v_note;

  update orders
     set notes = case when notes is null or notes = ''
                      then v_line
                      else notes || E'\n' || v_line end
   where id = p_order_id
   returning notes into v_notes;

  if not found then
    raise exception 'No such order.' using errcode = 'P0001';
  end if;

  insert into staff_events (staff_id, station_id, action, subject_id, detail)
  values (p_actor, p_station, 'order.note', p_order_id,
          jsonb_build_object('note', v_note));

  return v_notes;
end;
$$;

revoke all on function advance_order(uuid, order_status, uuid, uuid) from public, anon;
revoke all on function set_item_stock(uuid, uuid, integer, uuid) from public, anon;
revoke all on function note_order(uuid, text, uuid, uuid) from public, anon;
grant execute on function advance_order(uuid, order_status, uuid, uuid) to authenticated;
grant execute on function set_item_stock(uuid, uuid, integer, uuid) to authenticated;
grant execute on function note_order(uuid, text, uuid, uuid) to authenticated;
