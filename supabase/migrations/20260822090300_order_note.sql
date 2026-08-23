-- Notes go through an RPC for the same reason transitions do.
--
-- Staff have a select policy on orders and no update policy, and staff_events
-- has no insert policy at all — both deliberate. A note therefore cannot be
-- written from the client, and appending one from application code would have
-- silently updated zero rows.
--
-- Append-only, and deliberately not an edit of the priced lines: changing what
-- was charged after payment is a money hole. "Actually make it oat" is a note;
-- a price change means void and re-ring.
create function note_order(
  p_order_id uuid,
  p_note     text,
  p_actor    uuid,
  p_station  uuid
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

revoke all on function note_order(uuid, text, uuid, uuid) from public, anon;
grant execute on function note_order(uuid, text, uuid, uuid) to authenticated;
