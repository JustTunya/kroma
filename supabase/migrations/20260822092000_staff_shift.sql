-- A shift, with two timestamps.
--
-- The start overlay used to be a `useState(false)` in the board: it greeted
-- everyone, including a locked terminal that could not move an order, and it
-- came back on every reload in the middle of service. A shift is a fact about
-- a person, so it lives where every other fact about a person's day already
-- lives — staff_events, append-only, one row per boundary.
--
-- No `shifts` table: the open/closed state is the last boundary row, and a
-- second table would only be a cache of that with its own way of being wrong.
-- ponytail: O(1) per lookup on staff_events_staff_idx. A shifts table earns
-- its keep the day payroll needs to sum hours across a month.

-- When the caller's currently open shift began, or null if they are off.
create function staff_shift(p_staff_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case when last.action = 'shift.start' then last.created_at end
    from (select action, created_at
            from staff_events
           where staff_id = p_staff_id
             and action in ('shift.start', 'shift.end')
           order by created_at desc, id desc
           limit 1) last;
$$;

-- Open or close one. Returns the start of the shift that is now running, or
-- null if none is. Repeating the state you are already in writes nothing: two
-- iPads tapping start must not leave the ledger claiming two shifts.
create function shift_mark(p_staff_id uuid,
                           p_open boolean,
                           p_station uuid default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open timestamptz := staff_shift(p_staff_id);
  v_at   timestamptz;
begin
  if p_open = (v_open is not null) then
    return v_open;
  end if;

  insert into staff_events (staff_id, station_id, action, subject_id)
  values (p_staff_id, p_station,
          case when p_open then 'shift.start' else 'shift.end' end,
          p_staff_id)
  returning created_at into v_at;

  return case when p_open then v_at end;
end;
$$;

revoke all on function staff_shift(uuid) from public, anon;
revoke all on function shift_mark(uuid, boolean, uuid) from public, anon;
grant execute on function staff_shift(uuid) to authenticated;
grant execute on function shift_mark(uuid, boolean, uuid) to authenticated;
