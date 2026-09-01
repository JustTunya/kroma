-- The trading day.
--
-- Until now the schema modelled orders well and the day not at all: daily_stock
-- carried yesterday's leftovers into this morning, and order_number came from a
-- sequence that will be calling "482" by week three. Both are day-shaped facts
-- with nowhere to live.
--
-- One row per day, keyed by the shop-local date. The row existing means opened;
-- closed_at being null means still trading. No status column: two nullable
-- timestamps say the same thing and cannot contradict each other.

create table service_days (
  day          date primary key,
  opened_at    timestamptz not null default now(),
  opened_by    uuid references staff(id) on delete set null,
  closed_at    timestamptz,
  closed_by    uuid references staff(id) on delete set null,
  -- The next ticket the bar will call. Incremented under the row lock inside
  -- create_order(), which is already the serialization point for stock.
  next_number  integer not null default 1,
  float_cash   numeric(8,2) not null default 0,
  counted_cash numeric(8,2),
  count_detail jsonb,
  report       jsonb
);

-- What to bake to. Null means unlimited, exactly as daily_stock already does
-- for espresso-bar drinks.
alter table menu_items add column par_stock integer check (par_stock >= 0);

-- Today's counts are the only estimate of intended par that exists yet.
-- Leaving par_stock null on every batch-limited item would mean the first
-- open_service() sets daily_stock = null on all of them — unlimited, batch
-- control silently off — until someone hand-enters pars later.
update menu_items
   set par_stock = daily_stock
 where is_active
   and daily_stock is not null;

alter table orders
  add column service_day date references service_days(day),
  add column day_number  integer;

create index orders_service_day_idx on orders (service_day, day_number);

-- ------------------------------------------------------------------ backfill
-- Every historical order belongs to a day that really happened. Creating those
-- rows closed, with next_number past their highest ticket, means the sequence
-- is correct if one of them is ever reopened. Today is the one day that is not
-- history: if this migration runs mid-morning against a database that already
-- has orders today, closing "today" would leave open_service() finding it
-- closed with no reopen path in this task, locking out the day that has not
-- ended yet. So today's row, if orders already exist for it, is backfilled
-- open (closed_at null) with next_number past its highest ticket so far.
insert into service_days (day, opened_at, closed_at, next_number)
select d.day,
       d.first_at,
       case when d.day < (now() at time zone shop_tz())::date then d.last_at end,
       d.n + 1
  from (select (placed_at at time zone shop_tz())::date as day,
               min(placed_at) as first_at,
               max(placed_at) as last_at,
               count(*)::int  as n
          from orders
         group by 1) d
on conflict (day) do nothing;

update orders o
   set service_day = s.day,
       day_number  = s.n
  from (select id,
               (placed_at at time zone shop_tz())::date as day,
               row_number() over (
                 partition by (placed_at at time zone shop_tz())::date
                 order by placed_at, id)::int as n
          from orders) s
 where o.id = s.id;

-- Today, if it is open. Null is a closed shop, and every write path treats it
-- as a refusal rather than as "pick a day".
create function current_service_day()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select day from service_days
   where day = (now() at time zone shop_tz())::date
     and closed_at is null;
$$;

-- --------------------------------------------------------------- permissions
create or replace function staff_can(p_role staff_role, p_action text)
returns boolean
language sql
immutable
as $$
  select case p_action
    when 'order.view'       then true
    when 'order.advance'    then true
    when 'order.note'       then true
    when 'order.claim'      then true
    when 'item.86'          then true
    when 'order.abandon'    then true
    -- The first person in opens the shop. Making them find a manager at 07:15
    -- means the storefront sells against yesterday's stock, which is the exact
    -- reasoning that already puts item.86 in every barista's hands.
    when 'shop.open'        then true
    when 'order.void'       then p_role in ('owner', 'manager')
    when 'order.refund'     then p_role in ('owner', 'manager')
    when 'order.discount'   then p_role in ('owner', 'manager')
    when 'order.undo_late'  then p_role in ('owner', 'manager')
    when 'customer.contact' then p_role in ('owner', 'manager')
    when 'menu.edit'        then p_role in ('owner', 'manager')
    when 'analytics.view'   then p_role in ('owner', 'manager')
    -- The drawer is money, not bread.
    when 'shop.close'       then p_role in ('owner', 'manager')
    when 'staff.manage'     then p_role = 'owner'
    when 'shop.settings'    then p_role = 'owner'
    else false
  end;
$$;

-- ------------------------------------------------------------------- opening
create function open_service(p_actor uuid, p_stock jsonb default null)
returns service_days
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor staff;
  v_today date := (now() at time zone shop_tz())::date;
  v_row   service_days;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;

  if not staff_can(v_actor.role, 'shop.open') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;

  -- Two iPads tapping Open must not produce two openings, and must not wipe a
  -- morning's sales back to par. A plain select-then-insert has a gap under
  -- read-committed: both callers can see no row before either commits. The
  -- insert itself is the lock — on conflict, the loser gets nothing back
  -- (not an error) and falls through to read the winner's row, same as
  -- shift_mark() treats a repeated state as a no-op.
  insert into service_days (day, opened_by) values (v_today, p_actor)
  on conflict (day) do nothing
  returning * into v_row;

  if v_row.day is null then
    select * into v_row from service_days where day = v_today;
    if v_row.closed_at is not null then
      raise exception 'The day is already closed.' using errcode = 'P0001';
    end if;
    return v_row;
  end if;

  update menu_items set daily_stock = par_stock where is_active;

  if p_stock is not null then
    update menu_items m
       set daily_stock = (o.value #>> '{}')::integer
      from jsonb_each(p_stock) o
     where m.id = o.key::uuid;
  end if;

  insert into staff_events (staff_id, action, subject_id, detail)
  values (p_actor, 'shop.open', null,
          jsonb_build_object('day', v_today, 'stock', coalesce(p_stock, '{}'::jsonb)));

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------- RLS
alter table service_days enable row level security;

-- Staff read the day: the board needs to know whether it is open, and the
-- numbers page groups by it. Writes go through open_service/close_service only,
-- which are security definer — no insert or update policy exists on purpose.
create policy "service days staff read" on service_days
  for select using (is_staff());

revoke all on function open_service(uuid, jsonb) from public, anon;
grant execute on function open_service(uuid, jsonb) to authenticated;
grant execute on function current_service_day() to anon, authenticated;
