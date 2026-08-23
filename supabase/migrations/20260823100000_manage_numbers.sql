-- The numbers. Three read-only aggregates behind one permission.
--
-- These could all be client-side reduces over the existing select policies —
-- staff_events already reads manager-only and orders read to any active staff.
-- They are not, for two reasons. Orders read to ANY active staff, so a
-- barista's own session could total the month; the gate has to live where the
-- money is summed. And a thirty-day range is thousands of rows to ship in
-- order to render fourteen bars.
--
-- Every function takes p_actor and re-reads the role from the table, exactly
-- as advance_order() does. The signed cookie is a convenience for hiding a
-- button; this is the boundary.

-- Where the shop is. extract(hour from ...) runs in the session zone, which is
-- UTC on hosted Supabase — without this the morning rush lands at 04:00.
create function shop_tz() returns text
language sql immutable as $$ select 'Europe/Bucharest' $$;

-- ------------------------------------------------------------------- guard
create function manage_guard(p_actor uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v staff;
begin
  select * into v from staff where id = p_actor;
  if v.id is null or not v.is_active or v.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;
  if not staff_can(v.role, 'analytics.view') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;
end;
$$;

-- Which orders the shop actually kept the money for.
--
--   pending    never paid                    no money
--   cancelled  voided, money returned        no money
--   refunded   collected, money returned     no money
--   abandoned  made and binned, money STAYS  money
--
-- 'abandoned' being on the takings side is the whole reason that status
-- exists. It is waste, not a lost sale, and the two are counted separately.
create function order_was_paid(p_status order_status)
returns boolean
language sql
immutable
as $$
  select p_status in ('paid','preparing','ready','collected','abandoned');
$$;

-- ----------------------------------------------------------------- earnings
-- One jsonb rather than four result sets: the page draws it in one pass and a
-- second round trip per panel buys nothing.
create function manage_earnings(
  p_actor uuid,
  p_from  timestamptz,
  p_to    timestamptz
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform manage_guard(p_actor);

  with scoped as (
    select * from orders
     where placed_at >= p_from and placed_at < p_to
  ),
  kept as (
    select * from scoped where order_was_paid(status)
  ),
  -- Hour OF DAY, not hour of the range. "When is the rush" is the same
  -- question over one day and over thirty, and a thirty-bar-per-day strip
  -- answers neither.
  hours as (
    select extract(hour from placed_at at time zone shop_tz())::int as hour,
           count(*)::int                     as orders,
           sum(total) filter (where order_was_paid(status))    as taken,
           sum(total) filter (where status in ('cancelled','refunded')) as lost,
           count(*) filter (where status in ('cancelled','refunded','abandoned'))::int
             as lost_orders
      from scoped
     group by 1
  ),
  -- Staff-seconds on shift inside each hour of day, so the tape can put
  -- cover under demand on one axis. Clamped to the range at both ends and to
  -- now() for a shift still running.
  marks as (
    select staff_id, action, created_at,
           lead(created_at) over w as next_at,
           lead(action)     over w as next_action
      from staff_events
     where action in ('shift.start','shift.end')
       and created_at < p_to
       and created_at >= p_from - interval '2 days'
    window w as (partition by staff_id order by created_at, id)
  ),
  spans as (
    select greatest(created_at, p_from) as started,
           least(case when next_action = 'shift.end' then next_at end,
                 p_to, now())           as ended
      from marks
     where action = 'shift.start'
  ),
  -- One row per hour a span touches, carrying only the overlap. A shift from
  -- 07:20 to 11:05 contributes 40 min to hour 7 and 5 min to hour 11.
  cover as (
    select extract(hour from slot)::int as hour,
           sum(extract(epoch from (
             least(coalesce(ended, p_to) at time zone shop_tz(),
                   slot + interval '1 hour')
             - greatest(started at time zone shop_tz(), slot)
           )))::int as seconds
      from spans,
           lateral generate_series(
             date_trunc('hour', started at time zone shop_tz()),
             date_trunc('hour', coalesce(ended, p_to) at time zone shop_tz()),
             interval '1 hour') as slot
     where ended is null or ended > started
     group by 1
  ),
  items as (
    select oi.item_name,
           sum(oi.quantity)::int as qty,
           sum(oi.line_total)    as revenue
      from order_items oi
      join kept k on k.id = oi.order_id
     group by 1
  )
  select jsonb_build_object(
    'taken',   coalesce((select sum(total) from kept), 0),
    'orders',  (select count(*) from kept),
    'average', coalesce((select avg(total) from kept), 0),
    'online',  coalesce((select sum(total) from kept
                          where payment_method = 'online'), 0),
    'counter', coalesce((select sum(total) from kept
                          where payment_method = 'counter'), 0),
    -- Three shapes of loss, never added together. Voided and refunded money
    -- left; abandoned money stayed and the coffee went in the bin.
    'voided',    coalesce((select sum(total) from scoped
                            where status = 'cancelled'), 0),
    'refunded',  coalesce((select sum(total) from scoped
                            where status = 'refunded'), 0),
    'abandoned', coalesce((select sum(total) from scoped
                            where status = 'abandoned'), 0),
    'unpaid',    (select count(*) from scoped where status = 'pending'),
    -- Deliberately NOT scoped: it is what the empty state points at when the
    -- chosen window has nothing but the shop does. A manager opening this at
    -- 09:00 on a quiet Monday should not have to guess whether the page is
    -- broken or the morning is.
    'latest',    (select max(placed_at) from orders),
    'by_hour', coalesce((
      select jsonb_agg(jsonb_build_object(
               'hour',    coalesce(h.hour, c.hour),
               'orders',  coalesce(h.orders, 0),
               'taken',   coalesce(h.taken, 0),
               'lost',    coalesce(h.lost, 0),
               'lost_orders', coalesce(h.lost_orders, 0),
               'seconds', coalesce(c.seconds, 0))
             order by coalesce(h.hour, c.hour))
        from hours h full join cover c on c.hour = h.hour), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', item_name, 'qty', qty, 'revenue', revenue)
             order by qty desc, item_name)
        from items), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- --------------------------------------------------------------- behind the bar
-- Per person, over the range. Only what the schema can honestly answer:
-- claimed_by is stamped when an order enters 'preparing', so "made" means
-- "started by them", and the timings come off the same row.
create function manage_bar(
  p_actor uuid,
  p_from  timestamptz,
  p_to    timestamptz
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform manage_guard(p_actor);

  with marks as (
    select staff_id, action, created_at,
           lead(created_at) over w as next_at,
           lead(action)     over w as next_action
      from staff_events
     where action in ('shift.start','shift.end')
       and created_at < p_to
       and created_at >= p_from - interval '2 days'
    window w as (partition by staff_id order by created_at, id)
  ),
  shifts as (
    select staff_id,
           greatest(created_at, p_from) as started,
           least(case when next_action = 'shift.end' then next_at end,
                 p_to, now())           as ended,
           next_action is distinct from 'shift.end' as still_open
      from marks
     where action = 'shift.start'
       -- A shift that closed before the window opened is not in it.
       and (next_action is distinct from 'shift.end' or next_at > p_from)
  ),
  worked as (
    select staff_id,
           sum(extract(epoch from (ended - started)))::int as seconds,
           bool_or(still_open)                             as on_shift
      from shifts
     where ended > started
     group by 1
  ),
  made as (
    select claimed_by as staff_id,
           count(*)::int as made,
           -- Median, not mean: one order left brewing over a lunch break
           -- drags an average into uselessness.
           percentile_cont(0.5) within group (
             order by extract(epoch from (ready_at - started_at))
           )::int as median_seconds,
           count(*) filter (
             where ready_at - started_at <= interval '5 minutes'
           )::int as under_five,
           count(*) filter (where ready_at is not null)::int as timed
      from orders
     where claimed_by is not null
       and started_at >= p_from and started_at < p_to
     group by 1
  ),
  logged as (
    select staff_id,
           count(*) filter (where action = 'item.86')::int       as eighty_sixed,
           count(*) filter (where action = 'order.void')::int    as voided,
           count(*) filter (where action = 'order.refund')::int  as refunded,
           count(*) filter (where action = 'order.undo_late')::int as stepped_back
      from staff_events
     where created_at >= p_from and created_at < p_to
     group by 1
  )
  -- Busiest first, then alphabetically. 'made' is coalesced to 0 above, so
  -- there is no null to sort around.
  select coalesce(jsonb_agg(person order by (person->>'made')::int desc,
                            person->>'name'), '[]'::jsonb)
    into v_result
    from (
      select jsonb_build_object(
        'id',             s.id,
        'name',           s.display_name,
        'role',           s.role,
        'on_shift',       coalesce(w.on_shift, false),
        'seconds',        coalesce(w.seconds, 0),
        'made',           coalesce(m.made, 0),
        'median_seconds', m.median_seconds,
        'under_five',     coalesce(m.under_five, 0),
        'timed',          coalesce(m.timed, 0),
        'eighty_sixed',   coalesce(l.eighty_sixed, 0),
        'voided',         coalesce(l.voided, 0),
        'refunded',       coalesce(l.refunded, 0),
        'stepped_back',   coalesce(l.stepped_back, 0)
      ) as person
        from staff s
        left join worked w on w.staff_id = s.id
        left join made   m on m.staff_id = s.id
        left join logged l on l.staff_id = s.id
       where s.kind = 'person'
         -- A leaver stays visible for any window they actually worked.
         and (s.is_active or w.seconds is not null or m.made is not null)
    ) people;

  return v_result;
end;
$$;

-- ------------------------------------------------------------------- ledger
-- The audit trail, filtered. Returns a table rather than jsonb because this
-- one is paged and the page only ever walks it.
create function manage_ledger(
  p_actor   uuid,
  p_from    timestamptz,
  p_to      timestamptz,
  p_staff   uuid    default null,
  p_actions text[]  default null,
  p_limit   integer default 200,
  p_offset  integer default 0
) returns table (
  id           bigint,
  action       text,
  created_at   timestamptz,
  staff_id     uuid,
  staff_name   text,
  station_name text,
  subject_id   uuid,
  order_number integer,
  item_name    text,
  detail       jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform manage_guard(p_actor);

  return query
    select e.id,
           e.action,
           e.created_at,
           e.staff_id,
           actor.display_name,
           station.display_name,
           e.subject_id,
           o.order_number,
           m.name,
           e.detail
      from staff_events e
      left join staff actor   on actor.id = e.staff_id
      left join staff station on station.id = e.station_id
      -- subject_id is an order for most actions and a menu item for item.86.
      -- The join is left and the miss is expected.
      left join orders o      on o.id = e.subject_id
      left join menu_items m  on m.id = e.subject_id
     where e.created_at >= p_from
       and e.created_at <  p_to
       and (p_staff   is null or e.staff_id = p_staff)
       and (p_actions is null or e.action = any(p_actions))
     order by e.created_at desc, e.id desc
     limit greatest(least(p_limit, 500), 1)
    offset greatest(p_offset, 0);
end;
$$;

grant execute on function shop_tz() to authenticated;
revoke all on function manage_guard(uuid)                        from public, anon;
revoke all on function manage_earnings(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function manage_bar(uuid, timestamptz, timestamptz)      from public, anon;
revoke all on function manage_ledger(uuid, timestamptz, timestamptz, uuid, text[], integer, integer)
  from public, anon;

grant execute on function manage_earnings(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function manage_bar(uuid, timestamptz, timestamptz)      to authenticated;
grant execute on function manage_ledger(uuid, timestamptz, timestamptz, uuid, text[], integer, integer)
  to authenticated;
