-- The shop side of the house. Until now `auth.users` meant "customer" and
-- nothing in the schema knew that a person could work here.
--
-- Two session layers sit on top of this table (design doc §7): a station holds
-- a long-lived Supabase session so the board renders, and a person unlocks the
-- right to WRITE with a PIN. That split exists because the iPad behind the bar
-- is never logged out, and an audit log that pretends otherwise is worse than
-- no audit log at all.

create type staff_role as enum ('owner', 'manager', 'staff');

create table staff (
  id           uuid primary key default gen_random_uuid(),
  -- Null for a PIN-only employee. Set once a person needs off-premises login,
  -- which in practice means manager and owner.
  user_id      uuid unique references auth.users(id) on delete set null,
  kind         text not null default 'person'
                 check (kind in ('person', 'station')),
  display_name text not null,
  role         staff_role not null default 'staff',
  -- A default VIEW, never a permission: in a five-person shop the person
  -- nearest the machine helps, whatever the rota says.
  station      text not null default 'bar'
                 check (station in ('bar', 'kitchen')),
  pin_hash     text,
  failed_pins  smallint not null default 0,
  locked_until timestamptz,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- A station cannot act: no PIN means no actor session can ever be minted for
  -- it, which is what makes a stolen iPad worth nothing.
  constraint station_has_no_pin check (kind = 'person' or pin_hash is null)
);

create index staff_user_idx   on staff (user_id) where user_id is not null;
create index staff_active_idx on staff (is_active, display_name);

create trigger staff_updated_at before update on staff
  for each row execute function set_updated_at();

-- --------------------------------------------------------------------- audit
create table staff_events (
  id         bigint generated always as identity primary key,
  staff_id   uuid references staff(id) on delete set null,   -- who
  station_id uuid references staff(id) on delete set null,   -- where
  action     text not null,
  subject_id uuid,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index staff_events_recent_idx  on staff_events (created_at desc);
create index staff_events_subject_idx on staff_events (subject_id, created_at desc);
create index staff_events_staff_idx   on staff_events (staff_id, created_at desc);

-- ---------------------------------------------------------------- permissions
-- One authority. RLS policies call it, every write RPC calls it, and
-- lib/staff-permissions.ts mirrors it for the sole purpose of hiding buttons.
-- `else false` means a typo in an action name denies rather than grants.
create function staff_can(p_role staff_role, p_action text)
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

-- ------------------------------------------------------------ current station
-- The staff row behind the *Supabase session* — the station, or a manager on
-- their own phone. Not the actor: the actor is whoever last entered a PIN.
create function current_staff()
returns staff
language sql
stable
security definer
set search_path = public
as $$
  select * from staff where user_id = auth.uid() and is_active;
$$;

-- -------------------------------------------------------------------- unlock
-- Verifies a PIN and reports who it belongs to. The PIN is compared only in
-- here: never in application code, never logged.
create function staff_unlock(p_staff_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v staff;
begin
  select * into v from staff where id = p_staff_id;

  if v.id is null or not v.is_active or v.kind <> 'person' then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  if v.locked_until is not null and v.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked',
                              'until', v.locked_until);
  end if;

  -- Four digits is 10,000 combinations, so the lockout is not optional. Six
  -- digits is where staff start writing them on the wall, which is worse.
  --
  -- extensions.crypt, schema-qualified: pgcrypto lives in `extensions` on
  -- hosted Supabase, and widening a security definer function's search_path to
  -- reach it is the thing search_path pinning exists to prevent.
  if v.pin_hash is null
     or extensions.crypt(p_pin, v.pin_hash) <> v.pin_hash then
    update staff
       set failed_pins  = failed_pins + 1,
           locked_until = case when failed_pins + 1 >= 5
                               then now() + interval '15 minutes' end
     where id = p_staff_id
     returning * into v;

    if v.locked_until is not null then
      insert into staff_events (staff_id, action, subject_id)
      values (p_staff_id, 'staff.locked', p_staff_id);
    end if;

    return jsonb_build_object('ok', false, 'reason', 'bad_pin');
  end if;

  update staff set failed_pins = 0, locked_until = null where id = p_staff_id;

  insert into staff_events (staff_id, action, subject_id)
  values (p_staff_id, 'staff.unlock', p_staff_id);

  return jsonb_build_object(
    'ok', true, 'staff_id', v.id, 'role', v.role, 'display_name', v.display_name
  );
end;
$$;

-- --------------------------------------------------------------- first owner
-- Self-closing: the first caller becomes owner and the door shuts behind them.
-- No seed row with a known password, no env allowlist to keep in sync.
create function claim_owner(p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;

  if exists (select 1 from staff where role = 'owner') then
    raise exception 'This shop already has an owner.' using errcode = 'P0001';
  end if;

  insert into staff (user_id, display_name, role)
  values (auth.uid(), p_display_name, 'owner')
  returning id into v_id;

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------- RLS
alter table staff        enable row level security;
alter table staff_events enable row level security;

-- Staff read the roster: the unlock screen needs names and the board needs to
-- resolve claimed_by. pin_hash is never selected by application code, and the
-- functions that matter are security definer.
create policy "staff read roster" on staff
  for select using (
    exists (select 1 from staff s
             where s.user_id = auth.uid() and s.is_active)
  );

-- staff_events is append-only by construction: no insert, update or delete
-- policy exists at all. Only security definer RPCs write here, as a side
-- effect of the action they are already performing.
create policy "staff events read manager" on staff_events
  for select using (
    exists (select 1 from staff s
             where s.user_id = auth.uid()
               and s.is_active
               and staff_can(s.role, 'analytics.view'))
  );

-- Orders become visible to the shop. A customer's own JWT still matches only
-- the existing "orders read own" policy, so this grants them nothing new.
create policy "orders staff read" on orders
  for select using (
    exists (select 1 from staff s
             where s.user_id = auth.uid() and s.is_active)
  );

create policy "order items staff read" on order_items
  for select using (
    exists (select 1 from staff s
             where s.user_id = auth.uid() and s.is_active)
  );

-- The bar needs a customer's bar name and allergens to make the order right.
-- Contact details are NOT reachable through this: staff_order() projects only
-- bar_name and avoid_allergens, and email/phone stay behind a manager-gated
-- surface, because a barista does not need a phone number to make a cortado.
create policy "profiles staff read" on profiles
  for select using (
    exists (select 1 from staff s
             where s.user_id = auth.uid() and s.is_active)
  );

-- Staff advance orders only through advance_order(), which is security
-- definer. No update policy is granted here on purpose: a bare UPDATE has
-- nowhere to put the audit row or the stock movement.

revoke all on function staff_unlock(uuid, text) from public, anon;
grant execute on function staff_unlock(uuid, text) to authenticated;
revoke all on function claim_owner(text) from public, anon;
grant execute on function claim_owner(text) to authenticated;
revoke all on function current_staff() from public, anon;
grant execute on function current_staff() to authenticated;
grant execute on function staff_can(staff_role, text) to authenticated;
