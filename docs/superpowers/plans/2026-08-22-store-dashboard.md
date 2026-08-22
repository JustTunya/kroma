# Store Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the staff identity model and a live order board so the shop can see, advance, and settle orders in real time.

**Architecture:** Reads and live push go through `supabase-js` on a long-lived station session, gated by RLS. Every write goes through a Next.js server action that verifies a signed actor cookie and calls a `security definer` RPC, so the status change, the audit row, and the stock movement land in one transaction. One SQL function, `staff_can()`, is the single authority on permissions; TypeScript mirrors it only to hide buttons.

**Tech Stack:** Next.js 16 App Router · React 19 · Supabase (Postgres + Realtime + RLS) · Framer Motion 13 · Tailwind v4 · Stripe · `node --test`

**Spec:** `docs/superpowers/specs/2026-08-22-store-dashboard-design.md`

## Global Constraints

- **Storefront tokens only.** `bg-surface-canvas`, `text-text-secondary`, `border-hairline`, `kds-*`. Never the shadcn semantic tokens (`bg-background`, `text-muted-foreground`, `bg-primary`). CLAUDE.md §2.
- **The mono rule.** Every label, eyebrow, badge, pill, price, timestamp and spec line is uppercase mono with wide tracking. Sans is only for descriptive sentences. CLAUDE.md §3.
- **Tracking ladder:** `0.18em` eyebrows/status pills · `0.16em` nav pills · `0.14em` spec lines/stat lists · `0.02em` prices and counts · `-0.02em` serif headings.
- **Radii:** only `rounded-full` (pills, dots), `rounded-sm` (thumbnails), `rounded-lg` (large image frames). Rows and sections are never rounded. CLAUDE.md §4.
- **Structure is hairlines, not cards.** `divide-y divide-hairline border-y border-hairline` for lists; `md:border-l border-hairline` for column splits. On the KDS canvas the same rules use `kds-border`.
- **Page gutter, invariant:** `px-5 sm:px-10 lg:px-14`.
- **Motion:** import `spring` / `pressSpring` / `numberTransition` from `lib/motion.ts` and `glide` / `rise` / `inView` from `lib/reveal.ts`. Never inline a new spring or easing value. Animate only `opacity` and `transform`. Never mix `duration` with a spring.
- **Reduced motion:** every ambient animation checks `useReducedMotion()` and degrades to a static, still-usable state.
- **Focus:** `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus`, offset `4` on row-sized targets. Never removed.
- **Copy:** short declaratives, concrete numbers, operational language. "Gone for today", not "Sold out". No exclamation marks. CLAUDE.md §1.
- **Prices:** `€${n.toFixed(2)}` with `tabular-nums`.
- **`cn()`** from `lib/utils.ts` for every conditional class.
- **`ponytail:` comments** mark deliberate shortcuts with their upgrade path.
- **Tests:** `node --test lib/x.test.ts` for TypeScript; `begin` / `rollback` SQL files with `do $$ … end $$` assert blocks for the database, matching `supabase/tests/create_order.test.sql`.

---

## File Structure

**Database**
- `supabase/migrations/20260822090000_staff_identity.sql` — enum, `staff`, `staff_events`, `staff_can`, `staff_unlock`, `claim_owner`, RLS
- `supabase/migrations/20260822090100_order_status_refunded.sql` — the enum value, alone in its file
- `supabase/migrations/20260822090200_order_board.sql` — order columns, `advance_order`, `staff_order`, `set_item_stock`, the `card_punches` fix, realtime publication
- `supabase/tests/staff.test.sql` — identity, permissions, lockout
- `supabase/tests/order_board.test.sql` — transitions, stock, punches

**Library**
- `lib/staff-permissions.ts` — the TypeScript mirror of `staff_can`, for hiding buttons
- `lib/order-transitions.ts` — the transition map and the 90-second undo boundary
- `lib/staff-session.ts` — sign/verify the actor cookie (`node:crypto` HMAC, no dependency)
- `lib/staff.ts` — server-side reads: current staff row, roster
- `lib/order-age.ts` — age tier for the spine, shared by row and detail page

**Server actions**
- `app/dashboard/actions.ts` — `unlockAction`, `advanceOrderAction`, `noteOrderAction`, `setStockAction`, `refundOrderAction`, `lockAction`

**Routes**
- `app/dashboard/layout.tsx` — gate + shell
- `app/dashboard/page.tsx` — redirect to `/dashboard/board`
- `app/dashboard/unlock/page.tsx` — roster + keypad
- `app/dashboard/board/page.tsx` — server fetch, hands off to the client board
- `app/dashboard/order/[id]/page.tsx` — one order, audit trail, settle actions

**Components**
- `components/dashboard/StaffBar.tsx` — who is unlocked, connection state, lock button
- `components/dashboard/ConnectionPill.tsx` — LIVE / RECONNECTING / OFFLINE
- `components/dashboard/OrderBoard.tsx` — the client boundary: realtime, lanes, state
- `components/dashboard/OrderLane.tsx` — one column, header + hairline list
- `components/dashboard/OrderRow.tsx` — one order, the age spine
- `components/dashboard/AgeSpine.tsx` — the signature element
- `components/dashboard/PinPad.tsx` — roster picker + keypad

---

## Task 1: Staff identity schema

**Files:**
- Create: `supabase/migrations/20260822090000_staff_identity.sql`
- Test: `supabase/tests/staff.test.sql`

**Interfaces:**
- Consumes: `set_updated_at()` (exists, `20260815120000`), `pgcrypto` (enabled, same file)
- Produces: type `staff_role`; tables `staff`, `staff_events`; functions `staff_can(staff_role, text) → boolean`, `staff_unlock(uuid, text) → jsonb`, `claim_owner(text) → uuid`, `current_staff() → staff`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/staff.test.sql`:

```sql
-- Run against the hosted database. Everything is inside begin/rollback:
-- real schema, zero persistence.
begin;

do $$
declare
  v_owner   uuid;
  v_barista uuid;
  v_result  jsonb;
  v_locked  timestamptz;
begin
  -- Fixtures ---------------------------------------------------------------
  insert into staff (display_name, role, pin_hash)
  values ('Test Owner', 'owner', crypt('1111', gen_salt('bf', 4)))
  returning id into v_owner;

  insert into staff (display_name, role, pin_hash)
  values ('Test Barista', 'staff', crypt('2222', gen_salt('bf', 4)))
  returning id into v_barista;

  -- staff_can ---------------------------------------------------------------
  assert staff_can('staff',   'order.advance'),    'staff may advance';
  assert staff_can('staff',   'item.86'),          'staff may 86 an item';
  assert not staff_can('staff',   'order.void'),   'staff may not void';
  assert not staff_can('staff',   'order.refund'), 'staff may not refund';
  assert not staff_can('staff',   'analytics.view'), 'staff may not read numbers';
  assert staff_can('manager', 'order.void'),       'manager may void';
  assert staff_can('manager', 'customer.contact'), 'manager may reveal contact';
  assert not staff_can('manager', 'staff.manage'), 'manager may not manage staff';
  assert staff_can('owner',   'staff.manage'),     'owner may manage staff';
  assert not staff_can('owner', 'nonsense.action'), 'unknown action denies';

  -- staff_unlock ------------------------------------------------------------
  v_result := staff_unlock(v_barista, '9999');
  assert not (v_result ->> 'ok')::boolean, 'wrong PIN is refused';

  v_result := staff_unlock(v_barista, '2222');
  assert (v_result ->> 'ok')::boolean, 'right PIN is accepted';
  assert v_result ->> 'role' = 'staff', 'unlock returns the role';

  select failed_pins into strict v_locked from staff where id = v_barista;
  assert (select failed_pins from staff where id = v_barista) = 0,
    'a good PIN resets the counter';

  -- lockout -----------------------------------------------------------------
  for i in 1..5 loop
    perform staff_unlock(v_barista, '0000');
  end loop;

  select locked_until into v_locked from staff where id = v_barista;
  assert v_locked is not null and v_locked > now(), 'five misses lock the row';

  v_result := staff_unlock(v_barista, '2222');
  assert not (v_result ->> 'ok')::boolean, 'a locked row refuses a correct PIN';
  assert v_result ->> 'reason' = 'locked', 'and says why';

  -- lockouts are audited ----------------------------------------------------
  assert (select count(*) from staff_events
           where staff_id = v_barista and action = 'staff.locked') = 1,
    'the lockout wrote one audit row';

  -- station constraint ------------------------------------------------------
  begin
    insert into staff (display_name, kind, pin_hash)
    values ('Bad Station', 'station', crypt('3333', gen_salt('bf', 4)));
    assert false, 'a station must not be allowed a PIN';
  exception when check_violation then
    null;
  end;

  -- claim_owner is self-closing --------------------------------------------
  begin
    perform claim_owner('Second Owner');
    assert false, 'claim_owner must refuse once an owner exists';
  exception when others then
    null;
  end;

  raise notice 'staff.test.sql: all assertions passed';
end $$;

rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `supabase db reset && psql "$DATABASE_URL" -f supabase/tests/staff.test.sql`
Expected: FAIL with `relation "staff" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260822090000_staff_identity.sql`:

```sql
-- The shop side of the house. Until now `auth.users` meant "customer" and
-- nothing in the schema knew that a person could work here.
--
-- Two session layers sit on top of this table (see the design doc §7): a
-- station holds a long-lived Supabase session so the board renders, and a
-- person unlocks the right to WRITE with a PIN. That split exists because the
-- iPad behind the bar is never logged out and an audit log that pretends
-- otherwise is worse than no audit log.

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

-- ------------------------------------------------------------------- audit
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

-- -------------------------------------------------------------- permissions
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
    -- the person holding the empty tray is the one who knows. Making them find
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

-- ---------------------------------------------------------- current station
-- The staff row behind the *Supabase session* — the station, or a manager on
-- their own phone. Not the actor: the actor comes from a signed cookie.
create function current_staff()
returns staff
language sql
stable
security definer
set search_path = public
as $$
  select * from staff where user_id = auth.uid() and is_active;
$$;

-- ------------------------------------------------------------------ unlock
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
  if v.pin_hash is null or crypt(p_pin, v.pin_hash) <> v.pin_hash then
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

-- ------------------------------------------------------------- first owner
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

-- --------------------------------------------------------------------- RLS
alter table staff        enable row level security;
alter table staff_events enable row level security;

-- Staff read the roster: the unlock screen needs names, and the board needs to
-- resolve claimed_by. pin_hash is never selected by application code, and the
-- RPCs that matter are security definer.
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

-- Staff need the customer's bar name and allergens to make the order. Contact
-- details are NOT in this policy — they go through a manager-gated RPC that
-- writes an audit row, because a barista does not need a phone number to make
-- a cortado.
create policy "profiles staff read" on profiles
  for select using (
    exists (select 1 from staff s
             where s.user_id = auth.uid() and s.is_active)
  );

revoke all on function staff_unlock(uuid, text) from public, anon;
grant execute on function staff_unlock(uuid, text) to authenticated;
revoke all on function claim_owner(text) from public, anon;
grant execute on function claim_owner(text) to authenticated;
grant execute on function current_staff() to authenticated;
grant execute on function staff_can(staff_role, text) to authenticated;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase db reset && psql "$DATABASE_URL" -f supabase/tests/staff.test.sql`
Expected: `NOTICE: staff.test.sql: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260822090000_staff_identity.sql supabase/tests/staff.test.sql
git commit -m "feat(staff): staff identity, permissions and audit trail"
```

---

## Task 2: The `refunded` order status

**Files:**
- Create: `supabase/migrations/20260822090100_order_status_refunded.sql`

**Interfaces:**
- Produces: `order_status` gains the value `refunded`

This task is one line in its own file on purpose. Postgres will not let a new
enum value be *used* in the same transaction that adds it, so Task 3 cannot
contain the `alter type`.

- [ ] **Step 1: Write the migration**

```sql
-- Alone in this file, deliberately. Postgres refuses to USE a new enum value
-- in the transaction that adds it, and Supabase runs each migration file in
-- its own transaction — so anything referencing 'refunded' must land in a
-- later file. See 20260822090200_order_board.sql.
--
-- 'refunded' is distinct from 'cancelled' because the stock consequence is
-- opposite: a cancelled order never left the pass and its stock returns; a
-- refunded one was eaten and it does not.
alter type order_status add value 'refunded';
```

- [ ] **Step 2: Verify it applies**

Run: `supabase db reset && psql "$DATABASE_URL" -c "select unnest(enum_range(null::order_status));"`
Expected: seven rows, ending in `refunded`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260822090100_order_status_refunded.sql
git commit -m "feat(orders): add refunded status"
```

---

## Task 3: Order board schema

**Files:**
- Create: `supabase/migrations/20260822090200_order_board.sql`
- Test: `supabase/tests/order_board.test.sql`

**Interfaces:**
- Consumes: `staff_can`, `staff_events`, `staff` (Task 1); `refunded` (Task 2); `order_by_token` shape (exists)
- Produces: `orders.started_at`, `orders.collected_at`, `orders.claimed_by`; `advance_order(uuid, order_status, uuid, uuid) → jsonb`; `staff_order(uuid) → jsonb`; `staff_board() → jsonb`; `set_item_stock(uuid, integer, uuid, uuid) → integer`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/order_board.test.sql`:

```sql
begin;

insert into menu_categories (id, slug, name, earns_punch)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'board-cat', 'Board Category', true);

insert into menu_items (id, category_id, slug, name, base_price, daily_stock)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'board-bun', 'Board Bun', 3.50, 10);

do $$
declare
  v_manager uuid;
  v_barista uuid;
  v_station uuid;
  v_order   uuid;
  v_stock   integer;
  v_state   jsonb;
begin
  insert into staff (display_name, role, pin_hash)
  values ('Board Manager', 'manager', crypt('1111', gen_salt('bf', 4)))
  returning id into v_manager;

  insert into staff (display_name, role, pin_hash)
  values ('Board Barista', 'staff', crypt('2222', gen_salt('bf', 4)))
  returning id into v_barista;

  insert into staff (display_name, kind, role)
  values ('Board Station', 'station', 'staff')
  returning id into v_station;

  insert into orders (status, customer_name, subtotal, total, payment_method)
  values ('paid', 'Test Customer', 7.00, 7.00, 'counter')
  returning id into v_order;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, line_total, earns_punch)
  values (v_order, 'bbbbbbbb-0000-0000-0000-000000000001',
          'Board Bun', 3.50, 2, 7.00, true);

  update menu_items set daily_stock = 8
   where id = 'bbbbbbbb-0000-0000-0000-000000000001';

  -- forward transitions -----------------------------------------------------
  v_state := advance_order(v_order, 'preparing', v_barista, v_station);
  assert v_state ->> 'status' = 'preparing', 'paid advances to preparing';
  assert (select started_at from orders where id = v_order) is not null,
    'preparing stamps started_at';
  assert (select claimed_by from orders where id = v_order) = v_barista,
    'preparing claims the order';

  v_state := advance_order(v_order, 'ready', v_barista, v_station);
  assert (select ready_at from orders where id = v_order) is not null,
    'ready stamps ready_at';

  -- illegal transition ------------------------------------------------------
  begin
    perform advance_order(v_order, 'pending', v_barista, v_station);
    assert false, 'ready must not jump back to pending';
  exception when others then null;
  end;

  -- permission ---------------------------------------------------------------
  begin
    perform advance_order(v_order, 'cancelled', v_barista, v_station);
    assert false, 'staff must not void';
  exception when others then null;
  end;

  -- inactive actor -----------------------------------------------------------
  update staff set is_active = false where id = v_barista;
  begin
    perform advance_order(v_order, 'collected', v_barista, v_station);
    assert false, 'an inactive actor must be refused';
  exception when others then null;
  end;
  update staff set is_active = true where id = v_barista;

  v_state := advance_order(v_order, 'collected', v_barista, v_station);
  assert (select collected_at from orders where id = v_order) is not null,
    'collected stamps collected_at';

  -- refund keeps the stock gone ---------------------------------------------
  select daily_stock into v_stock from menu_items
   where id = 'bbbbbbbb-0000-0000-0000-000000000001';

  v_state := advance_order(v_order, 'refunded', v_manager, v_station);
  assert v_state ->> 'status' = 'refunded', 'manager may refund';
  assert (select daily_stock from menu_items
           where id = 'bbbbbbbb-0000-0000-0000-000000000001') = v_stock,
    'a refund does NOT restore stock';

  -- every transition is audited ---------------------------------------------
  assert (select count(*) from staff_events
           where subject_id = v_order and action like 'order.%') >= 4,
    'each transition wrote an audit row';

  raise notice 'order_board.test.sql: transitions passed';
end $$;

-- a void DOES restore stock ---------------------------------------------------
do $$
declare
  v_manager uuid;
  v_order   uuid;
begin
  insert into staff (display_name, role) values ('Void Manager', 'manager')
  returning id into v_manager;

  update menu_items set daily_stock = 5
   where id = 'bbbbbbbb-0000-0000-0000-000000000001';

  insert into orders (status, subtotal, total, payment_method)
  values ('paid', 3.50, 3.50, 'counter') returning id into v_order;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, line_total)
  values (v_order, 'bbbbbbbb-0000-0000-0000-000000000001',
          'Board Bun', 3.50, 1, 3.50);

  perform advance_order(v_order, 'cancelled', v_manager, null);

  assert (select daily_stock from menu_items
           where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 6,
    'a void restores stock';

  raise notice 'order_board.test.sql: void restores stock';
end $$;

-- a refunded order stops earning punches -------------------------------------
do $$
declare
  v_user  uuid;
  v_order uuid;
  v_before integer;
begin
  insert into auth.users (id, email) values (gen_random_uuid(), 'punch@test.local')
  returning id into v_user;

  v_before := card_punches(v_user);

  insert into orders (user_id, status, subtotal, total, payment_method)
  values (v_user, 'refunded', 3.50, 3.50, 'counter') returning id into v_order;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, line_total, earns_punch)
  values (v_order, 'bbbbbbbb-0000-0000-0000-000000000001',
          'Board Bun', 3.50, 1, 3.50, true);

  assert card_punches(v_user) = v_before,
    'a refunded order must not mint a punch';

  raise notice 'order_board.test.sql: refunds do not mint punches';
end $$;

rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `psql "$DATABASE_URL" -f supabase/tests/order_board.test.sql`
Expected: FAIL with `function advance_order(...) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260822090200_order_board.sql`:

```sql
-- The pass, in SQL. Every status change goes through advance_order() so the
-- state change, the audit row and the stock movement share one transaction —
-- a bare UPDATE from the client has nowhere to put the other two.

alter table orders
  add column started_at   timestamptz,
  add column collected_at timestamptz,
  add column claimed_by   uuid references staff(id) on delete set null;

-- ------------------------------------------------------- the punches fix
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

-- ------------------------------------------------------------ transitions
-- Which permission each move needs. Anything absent from this function is not
-- a legal transition and advance_order raises.
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
    -- one lane back. The 90-second window is applied by advance_order, which
    -- is the only caller that knows how long ago the stamp was written.
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

  -- Stepping back is free for 90 seconds — "ready" gets pressed early all day
  -- and a hard one-way machine just gets worked around with voids, which is
  -- worse for the data than a logged undo. After that it is a manager's call.
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

-- ------------------------------------------------------------------ reads
-- One order, staff projection. Mirrors order_by_token()'s shape so the two
-- confirmation surfaces and the board never disagree about a field name.
-- access_token and the stripe_* columns stay out, exactly as they do there.
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
        'id',             o.id,
        'order_number',   o.order_number,
        'status',         o.status,
        'customer_name',  o.customer_name,
        'notes',          o.notes,
        'subtotal',       o.subtotal,
        'total',          o.total,
        'payment_method', o.payment_method,
        'placed_at',      o.placed_at,
        'pickup_at',      o.pickup_at,
        'started_at',     o.started_at,
        'ready_at',       o.ready_at,
        'collected_at',   o.collected_at,
        'claimed_by',     (select display_name from staff where id = o.claimed_by),
        -- The bar name, not the account name: plenty of people are
        -- "Alexandra Popescu" on the account and "Alex" across the room.
        'bar_name',       p.bar_name,
        'avoid_allergens', coalesce(p.avoid_allergens, '{}'),
        'is_regular',     coalesce((select count(*) from orders o2
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
              and o.collected_at >= date_trunc('day',
                    now() at time zone 'Europe/Bucharest')
                    at time zone 'Europe/Bucharest')
    ), '[]'::jsonb)
  end;
$$;

-- ------------------------------------------------------------------ stock
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

-- --------------------------------------------------------------- realtime
-- The board subscribes to `orders` only. order_items rows arrive in a separate
-- replication message from their parent insert, so subscribing to both renders
-- a card with no lines for a few hundred milliseconds on every new order.
-- Instead any event triggers a staff_order() re-fetch of that one order.
alter publication supabase_realtime add table orders;

revoke all on function advance_order(uuid, order_status, uuid, uuid) from public, anon;
revoke all on function set_item_stock(uuid, integer, uuid, uuid) from public, anon;
revoke all on function staff_order(uuid) from public, anon;
revoke all on function staff_board() from public, anon;
grant execute on function advance_order(uuid, order_status, uuid, uuid) to authenticated;
grant execute on function set_item_stock(uuid, integer, uuid, uuid) to authenticated;
grant execute on function staff_order(uuid) to authenticated;
grant execute on function staff_board() to authenticated;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase db reset && psql "$DATABASE_URL" -f supabase/tests/order_board.test.sql`
Expected: three `NOTICE` lines, no assertion failures.

- [ ] **Step 5: Regenerate types**

Run: `supabase gen types typescript --local > types/supabase.ts`
Expected: `types/supabase.ts` gains `staff`, `staff_events`, and the new functions.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260822090200_order_board.sql supabase/tests/order_board.test.sql types/supabase.ts
git commit -m "feat(board): order transitions, staff reads and stock control"
```

---

## Task 4: Permission and transition mirrors

**Files:**
- Create: `lib/staff-permissions.ts`, `lib/staff-permissions.test.ts`
- Create: `lib/order-transitions.ts`, `lib/order-transitions.test.ts`

**Interfaces:**
- Produces: `StaffRole`, `StaffAction`, `staffCan(role, action) → boolean`, `ROLE_LABELS`; `NEXT_STATUS`, `transitionAction(from, to) → StaffAction | null`, `UNDO_WINDOW_MS`, `canUndoFreely(stampedAt, now) → boolean`

- [ ] **Step 1: Write the failing tests**

Create `lib/staff-permissions.test.ts`:

```ts
// node --test lib/staff-permissions.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { STAFF_ACTIONS, staffCan } from "./staff-permissions.ts";

test("staff may run the pass but not settle money", () => {
  assert.equal(staffCan("staff", "order.advance"), true);
  assert.equal(staffCan("staff", "item.86"), true);
  assert.equal(staffCan("staff", "order.void"), false);
  assert.equal(staffCan("staff", "order.refund"), false);
  assert.equal(staffCan("staff", "customer.contact"), false);
});

test("manager settles money but does not manage the roster", () => {
  assert.equal(staffCan("manager", "order.void"), true);
  assert.equal(staffCan("manager", "analytics.view"), true);
  assert.equal(staffCan("manager", "staff.manage"), false);
});

test("owner can do everything on the list", () => {
  for (const action of STAFF_ACTIONS) {
    assert.equal(staffCan("owner", action), true, `owner denied ${action}`);
  }
});

test("an unknown action denies rather than grants", () => {
  // @ts-expect-error deliberately outside the union
  assert.equal(staffCan("owner", "nonsense.action"), false);
});
```

Create `lib/order-transitions.test.ts`:

```ts
// node --test lib/order-transitions.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  UNDO_WINDOW_MS,
  canUndoFreely,
  transitionAction,
} from "./order-transitions.ts";

test("forward moves along the pass need only order.advance", () => {
  assert.equal(transitionAction("pending", "paid"), "order.advance");
  assert.equal(transitionAction("paid", "preparing"), "order.advance");
  assert.equal(transitionAction("preparing", "ready"), "order.advance");
  assert.equal(transitionAction("ready", "collected"), "order.advance");
});

test("voiding and refunding are separate permissions", () => {
  assert.equal(transitionAction("paid", "cancelled"), "order.void");
  assert.equal(transitionAction("collected", "refunded"), "order.refund");
});

test("a refund is only reachable from collected", () => {
  assert.equal(transitionAction("ready", "refunded"), null);
});

test("skipping a lane is not a transition", () => {
  assert.equal(transitionAction("paid", "collected"), null);
  assert.equal(transitionAction("ready", "pending"), null);
});

test("one lane back is an undo", () => {
  assert.equal(transitionAction("ready", "preparing"), "order.undo");
  assert.equal(transitionAction("collected", "ready"), "order.undo");
});

test("the undo window is 90 seconds, inclusive at the boundary", () => {
  const now = new Date("2026-08-22T10:00:00Z");
  const justInside = new Date(now.getTime() - UNDO_WINDOW_MS);
  const justOutside = new Date(now.getTime() - UNDO_WINDOW_MS - 1);

  assert.equal(canUndoFreely(justInside, now), true);
  assert.equal(canUndoFreely(justOutside, now), false);
  assert.equal(canUndoFreely(null, now), false);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test lib/staff-permissions.test.ts lib/order-transitions.test.ts`
Expected: FAIL — `Cannot find module './staff-permissions.ts'`.

- [ ] **Step 3: Write the mirrors**

Create `lib/staff-permissions.ts`:

```ts
/**
 * The TypeScript half of staff_can(). Its ONLY job is hiding buttons a person
 * cannot use — the authorization decision is made in SQL, inside the security
 * definer RPC, every single time. staff-permissions.test.ts and staff.test.sql
 * assert the same table so the two cannot drift.
 */
export const STAFF_ROLES = ["owner", "manager", "staff"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ACTIONS = [
  "order.view",
  "order.advance",
  "order.note",
  "order.claim",
  "item.86",
  "order.void",
  "order.refund",
  "order.discount",
  "order.undo_late",
  "customer.contact",
  "menu.edit",
  "analytics.view",
  "staff.manage",
  "shop.settings",
] as const;
export type StaffAction = (typeof STAFF_ACTIONS)[number];

const MANAGER_UP: StaffRole[] = ["owner", "manager"];

export function staffCan(role: StaffRole, action: StaffAction): boolean {
  switch (action) {
    case "order.view":
    case "order.advance":
    case "order.note":
    case "order.claim":
    // The person holding the empty tray is the one who knows.
    case "item.86":
      return true;
    case "order.void":
    case "order.refund":
    case "order.discount":
    case "order.undo_late":
    case "customer.contact":
    case "menu.edit":
    case "analytics.view":
      return MANAGER_UP.includes(role);
    case "staff.manage":
    case "shop.settings":
      return role === "owner";
    default:
      // A typo denies rather than grants.
      return false;
  }
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Bar",
};
```

Create `lib/order-transitions.ts`:

```ts
import type { OrderStatus } from "@/lib/order-status";
import type { StaffAction } from "@/lib/staff-permissions";

/**
 * The pass, as a graph. Mirrors order_transition_action() in
 * 20260822090200_order_board.sql — advance_order() is the authority, this is
 * what lets the board grey out a button before the round trip.
 */

/** Forward, one lane at a time. */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "paid",
  paid: "preparing",
  preparing: "ready",
  ready: "collected",
};

/** Backwards, one lane at a time. */
export const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  paid: "pending",
  preparing: "paid",
  ready: "preparing",
  collected: "ready",
};

const VOIDABLE: OrderStatus[] = ["pending", "paid", "preparing", "ready"];

/**
 * "order.undo" is not a permission — advance_order() resolves it to
 * order.advance inside the window and order.undo_late outside it, because only
 * the database knows when the stamp was written.
 */
export function transitionAction(
  from: OrderStatus,
  to: OrderStatus,
): StaffAction | "order.undo" | null {
  if (to === "cancelled") return VOIDABLE.includes(from) ? "order.void" : null;
  if (to === "refunded") return from === "collected" ? "order.refund" : null;
  if (NEXT_STATUS[from] === to) return "order.advance";
  if (PREV_STATUS[from] === to) return "order.undo";
  return null;
}

/** Stepping back is free for a minute and a half. Then it is a manager's call. */
export const UNDO_WINDOW_MS = 90_000;

export function canUndoFreely(stampedAt: Date | null, now: Date): boolean {
  if (!stampedAt) return false;
  return now.getTime() - stampedAt.getTime() <= UNDO_WINDOW_MS;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test lib/staff-permissions.test.ts lib/order-transitions.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Add `refunded` to the status vocabulary**

Modify `lib/order-status.ts` — add `"refunded"` to `ORDER_STATUSES`, add the label, and settle it:

```ts
export const ORDER_STATUSES = [
  "pending",
  "paid",
  "preparing",
  "ready",
  "collected",
  "cancelled",
  "refunded",
] as const;

// … inside ORDER_STATUS_LABELS:
  refunded: { text: "Refunded", tone: "text-badge-alert" },

/** Settled orders stop polling — nothing more will happen to them. */
export function isSettled(status: OrderStatus): boolean {
  return status === "collected" || status === "cancelled" || status === "refunded";
}
```

- [ ] **Step 6: Run the whole suite and commit**

```bash
node --test lib/*.test.ts
git add lib/staff-permissions.ts lib/staff-permissions.test.ts lib/order-transitions.ts lib/order-transitions.test.ts lib/order-status.ts
git commit -m "feat(staff): permission and transition mirrors"
```

---

## Task 5: The actor session

**Files:**
- Create: `lib/staff-session.ts`, `lib/staff-session.test.ts`

**Interfaces:**
- Consumes: `StaffRole` (Task 4)
- Produces: `ACTOR_COOKIE`, `ACTOR_TTL_MS`, `signActor(payload, secret) → string`, `readActor(token, secret, now?) → ActorPayload | null`, type `ActorPayload = { staffId: string; role: StaffRole; name: string; exp: number }`

Signed with `node:crypto` HMAC. No dependency: a JWT library buys nothing here
because we are both issuer and audience, and the payload is four fields.

- [ ] **Step 1: Write the failing test**

Create `lib/staff-session.test.ts`:

```ts
// node --test lib/staff-session.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { ACTOR_TTL_MS, readActor, signActor } from "./staff-session.ts";

const SECRET = "test-secret-not-a-real-one";
const NOW = new Date("2026-08-22T10:00:00Z");

const payload = {
  staffId: "11111111-1111-1111-1111-111111111111",
  role: "manager" as const,
  name: "Ana",
  exp: NOW.getTime() + ACTOR_TTL_MS,
};

test("a token round-trips", () => {
  const token = signActor(payload, SECRET);
  assert.deepEqual(readActor(token, SECRET, NOW), payload);
});

test("a tampered payload is rejected", () => {
  const token = signActor(payload, SECRET);
  const [body, sig] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ ...payload, role: "owner" }),
  ).toString("base64url");
  assert.equal(readActor(`${forged}.${sig}`, SECRET, NOW), null);
  assert.notEqual(body, forged);
});

test("a token signed with another secret is rejected", () => {
  assert.equal(readActor(signActor(payload, "other"), SECRET, NOW), null);
});

test("an expired token is rejected", () => {
  const token = signActor(payload, SECRET);
  const later = new Date(NOW.getTime() + ACTOR_TTL_MS + 1);
  assert.equal(readActor(token, SECRET, later), null);
});

test("garbage is rejected without throwing", () => {
  assert.equal(readActor("", SECRET, NOW), null);
  assert.equal(readActor("not-a-token", SECRET, NOW), null);
  assert.equal(readActor("a.b.c", SECRET, NOW), null);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test lib/staff-session.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `lib/staff-session.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

import type { StaffRole } from "@/lib/staff-permissions";

/**
 * The right to write, in a cookie.
 *
 * A station session renders the board; this proves a *person* unlocked it with
 * their PIN. Fifteen minutes, sliding, because the iPad is never logged out and
 * a shift-boundary login model produces an audit log that lies.
 *
 * node:crypto rather than a JWT library: we are both issuer and audience, the
 * payload is four fields, and a dependency here earns nothing.
 *
 * ponytail: a signed cookie means no instant remote kill of an in-flight
 * session. advance_order() re-reads is_active on every write, which caps the
 * exposure at one already-authorized action. Upgrade path if that is ever not
 * enough: a staff_sessions table with a revocation check inside the RPC.
 */

export const ACTOR_COOKIE = "kroma_actor";
export const ACTOR_TTL_MS = 15 * 60 * 1000;

export type ActorPayload = {
  staffId: string;
  role: StaffRole;
  name: string;
  /** Epoch ms. */
  exp: number;
};

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signActor(payload: ActorPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function readActor(
  token: string | undefined,
  secret: string,
  now: Date = new Date(),
): ActorPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, given] = parts;

  const expected = sign(body, secret);
  // Compare as bytes of equal length, or timingSafeEqual throws.
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as ActorPayload;
    if (typeof payload.exp !== "number" || payload.exp <= now.getTime()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function actorSecret(): string {
  const secret = process.env.STAFF_SESSION_SECRET;
  if (!secret) throw new Error("STAFF_SESSION_SECRET is not set");
  return secret;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/staff-session.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Document the env var**

Append to `.env.example` (create it if absent):

```
# Signs the staff actor cookie. Any long random string; rotate to log everyone out.
STAFF_SESSION_SECRET=
```

- [ ] **Step 6: Commit**

```bash
git add lib/staff-session.ts lib/staff-session.test.ts .env.example
git commit -m "feat(staff): signed actor session cookie"
```

---

## Task 6: Server reads and the route gate

**Files:**
- Create: `lib/staff.ts`, `lib/order-age.ts`, `lib/order-age.test.ts`
- Modify: `lib/middleware.ts`

**Interfaces:**
- Consumes: `readActor`, `actorSecret`, `ACTOR_COOKIE` (Task 5); `createClient` from `lib/server.ts`
- Produces: `currentStaff() → StaffRow | null`, `currentActor() → ActorPayload | null`, `roster() → RosterEntry[]`, `requireActor(action) → ActorPayload`; `ageTier(placedAt, now) → "fresh" | "warm" | "late"`, `AGE_TONES`

- [ ] **Step 1: Write the failing test**

Create `lib/order-age.test.ts`:

```ts
// node --test lib/order-age.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { ageTier, elapsedLabel } from "./order-age.ts";

const NOW = new Date("2026-08-22T10:00:00Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);

test("under five minutes is fresh", () => {
  assert.equal(ageTier(minutesAgo(0), NOW), "fresh");
  assert.equal(ageTier(minutesAgo(4.9), NOW), "fresh");
});

test("five to ten minutes is warm", () => {
  assert.equal(ageTier(minutesAgo(5), NOW), "warm");
  assert.equal(ageTier(minutesAgo(9.9), NOW), "warm");
});

test("past ten minutes is late", () => {
  assert.equal(ageTier(minutesAgo(10), NOW), "late");
  assert.equal(ageTier(minutesAgo(45), NOW), "late");
});

test("the label counts in whole minutes, mono-friendly", () => {
  assert.equal(elapsedLabel(minutesAgo(0), NOW), "0:00");
  assert.equal(elapsedLabel(minutesAgo(1.5), NOW), "1:30");
  assert.equal(elapsedLabel(minutesAgo(12), NOW), "12:00");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test lib/order-age.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/order-age.ts`**

```ts
/**
 * How long a thing has been waiting, in the only three states a bar cares
 * about. Drives the age spine on every row and the timer on the detail page,
 * so both agree about when an order has gone late.
 */
export type AgeTier = "fresh" | "warm" | "late";

const WARM_MS = 5 * 60_000;
const LATE_MS = 10 * 60_000;

export function ageTier(since: Date, now: Date = new Date()): AgeTier {
  const elapsed = now.getTime() - since.getTime();
  if (elapsed >= LATE_MS) return "late";
  if (elapsed >= WARM_MS) return "warm";
  return "fresh";
}

/** Fill fraction for the spine, capped so a forgotten order stays at full. */
export function ageFraction(since: Date, now: Date = new Date()): number {
  return Math.min(1, Math.max(0, (now.getTime() - since.getTime()) / LATE_MS));
}

/** m:ss, tabular. Never "about 3 minutes" — a bar reads numbers. */
export function elapsedLabel(since: Date, now: Date = new Date()): string {
  const total = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Spine and type colours per tier, on the KDS canvas. */
export const AGE_TONES: Record<AgeTier, { spine: string; text: string }> = {
  fresh: { spine: "bg-kds-text-secondary", text: "text-kds-text-primary" },
  warm: { spine: "bg-accent-primary", text: "text-accent-primary" },
  late: { spine: "bg-badge-alert", text: "text-badge-alert" },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/order-age.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write `lib/staff.ts`**

```ts
import "server-only";
import { cookies } from "next/headers";

import { createClient } from "@/lib/server";
import { ACTOR_COOKIE, actorSecret, readActor } from "@/lib/staff-session";
import { staffCan } from "@/lib/staff-permissions";

import type { ActorPayload } from "@/lib/staff-session";
import type { StaffAction, StaffRole } from "@/lib/staff-permissions";

export type StaffRow = {
  id: string;
  display_name: string;
  role: StaffRole;
  kind: "person" | "station";
  station: "bar" | "kitchen";
};

export type RosterEntry = { id: string; display_name: string; role: StaffRole };

/**
 * The staff row behind the Supabase session — the station, or a manager on
 * their own phone. Not the actor: the actor is whoever last entered a PIN.
 */
export async function currentStaff(): Promise<StaffRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("current_staff").maybeSingle();
  return (data as StaffRow | null) ?? null;
}

/** Whoever unlocked the terminal, if their fifteen minutes are still running. */
export async function currentActor(): Promise<ActorPayload | null> {
  const store = await cookies();
  return readActor(store.get(ACTOR_COOKIE)?.value, actorSecret());
}

/**
 * Guard for a server action. Throws rather than returning null: an action that
 * forgets to check would otherwise write with no actor at all.
 *
 * This is a convenience, not the security boundary — advance_order() re-reads
 * the role from the database on every call and does not trust this cookie.
 */
export async function requireActor(action: StaffAction): Promise<ActorPayload> {
  const actor = await currentActor();
  if (!actor) throw new Error("Unlock first.");
  if (!staffCan(actor.role, action)) throw new Error("Not yours to do.");
  return actor;
}

/** Names for the unlock screen. Stations are not people and never appear. */
export async function roster(): Promise<RosterEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("id, display_name, role")
    .eq("kind", "person")
    .eq("is_active", true)
    .order("display_name");
  return (data as RosterEntry[] | null) ?? [];
}
```

- [ ] **Step 6: Gate `/dashboard` in the proxy**

Modify `lib/middleware.ts`. After the existing `/account` block, before the
`/auth` block, insert:

```ts
  // The dashboard is staff-only. This is user experience, not security: the
  // real boundary is RLS plus a fresh role read inside every write RPC. A
  // redirect rather than a 403, because a 403 confirms the route exists.
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.sub)
      .eq('is_active', true)
      .maybeSingle()

    if (!staff) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }
```

- [ ] **Step 7: Verify the gate**

Run: `pnpm dev`, sign in as a customer account, visit `http://localhost:3000/dashboard/board`.
Expected: redirected to `/`. Signed out: redirected to `/auth/login`.

- [ ] **Step 8: Commit**

```bash
git add lib/staff.ts lib/order-age.ts lib/order-age.test.ts lib/middleware.ts
git commit -m "feat(staff): server reads, age tiers and the dashboard gate"
```

---

## Task 7: Server actions

**Files:**
- Create: `app/dashboard/actions.ts`

**Interfaces:**
- Consumes: `requireActor`, `currentStaff` (Task 6); `signActor`, `ACTOR_COOKIE`, `ACTOR_TTL_MS`, `actorSecret` (Task 5); `advance_order`, `set_item_stock`, `staff_unlock` (Tasks 1, 3)
- Produces: `unlockAction(staffId, pin) → { ok: boolean; error?: string }`, `lockAction()`, `advanceOrderAction(orderId, to) → { ok, error? }`, `setStockAction(itemId, stock) → { ok, error? }`, `noteOrderAction(orderId, note) → { ok, error? }`

- [ ] **Step 1: Write the actions**

```ts
"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/server";
import { currentStaff, requireActor } from "@/lib/staff";
import {
  ACTOR_COOKIE,
  ACTOR_TTL_MS,
  actorSecret,
  signActor,
} from "@/lib/staff-session";

import type { OrderStatus } from "@/lib/order-status";
import type { StaffRole } from "@/lib/staff-permissions";

type Result = { ok: boolean; error?: string };

/** Anything the RPC raises is already worded for a person. Pass it through. */
function fail(error: unknown): Result {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message };
}

/**
 * Roster pick plus PIN buys fifteen minutes of write access. The PIN is posted
 * here and verified inside staff_unlock() — it is never compared in this file
 * and never logged.
 */
export async function unlockAction(staffId: string, pin: string): Promise<Result> {
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: "Four digits." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_unlock", {
    p_staff_id: staffId,
    p_pin: pin,
  });

  if (error) return fail(error);

  const result = data as {
    ok: boolean;
    reason?: string;
    staff_id?: string;
    role?: StaffRole;
    display_name?: string;
  };

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "locked"
          ? "Locked for 15 minutes. Ask the owner."
          : "That PIN is not right.",
    };
  }

  const store = await cookies();
  store.set(
    ACTOR_COOKIE,
    signActor(
      {
        staffId: result.staff_id!,
        role: result.role!,
        name: result.display_name!,
        exp: Date.now() + ACTOR_TTL_MS,
      },
      actorSecret(),
    ),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/dashboard",
      maxAge: ACTOR_TTL_MS / 1000,
    },
  );

  return { ok: true };
}

/** Hand the terminal back. The station session stays; only the person leaves. */
export async function lockAction(): Promise<void> {
  const store = await cookies();
  store.delete(ACTOR_COOKIE);
}

/**
 * One transition. advance_order() owns the rules — this only carries the actor
 * and the station, and re-signs the cookie so an active shift slides forward.
 */
export async function advanceOrderAction(
  orderId: string,
  to: OrderStatus,
): Promise<Result> {
  try {
    // 'order.advance' is the floor: the RPC re-derives the real action from the
    // transition and refuses if this actor's role cannot do it.
    const actor = await requireActor("order.advance");
    const station = await currentStaff();
    const supabase = await createClient();

    const { error } = await supabase.rpc("advance_order", {
      p_order_id: orderId,
      p_to: to,
      p_actor: actor.staffId,
      p_station: station?.id ?? null,
    });
    if (error) return fail(error);

    await slide(actor);
    revalidatePath("/dashboard/board");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setStockAction(
  itemId: string,
  stock: number | null,
): Promise<Result> {
  try {
    const actor = await requireActor("item.86");
    const station = await currentStaff();
    const supabase = await createClient();

    const { error } = await supabase.rpc("set_item_stock", {
      p_item_id: itemId,
      p_stock: stock,
      p_actor: actor.staffId,
      p_station: station?.id ?? null,
    });
    if (error) return fail(error);

    await slide(actor);
    revalidatePath("/dashboard/board");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Appends to the order's note. Deliberately append-only and deliberately not an
 * edit of the priced lines: changing what was charged after payment is a money
 * hole. A price change means void and re-ring.
 */
export async function noteOrderAction(
  orderId: string,
  note: string,
): Promise<Result> {
  const trimmed = note.trim();
  if (!trimmed) return { ok: false, error: "Nothing to add." };
  if (trimmed.length > 280) return { ok: false, error: "Keep it under 280." };

  try {
    const actor = await requireActor("order.note");
    const station = await currentStaff();
    const supabase = await createClient();

    const { data: order } = await supabase
      .from("orders")
      .select("notes")
      .eq("id", orderId)
      .maybeSingle();

    const line = `${actor.name}: ${trimmed}`;
    const { error } = await supabase
      .from("orders")
      .update({ notes: order?.notes ? `${order.notes}\n${line}` : line })
      .eq("id", orderId);
    if (error) return fail(error);

    await supabase.from("staff_events").insert({
      staff_id: actor.staffId,
      station_id: station?.id ?? null,
      action: "order.note",
      subject_id: orderId,
      detail: { note: trimmed },
    });

    await slide(actor);
    revalidatePath(`/dashboard/order/${orderId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Fifteen minutes from the last thing you did, not from when you unlocked. */
async function slide(actor: { staffId: string; role: StaffRole; name: string }) {
  const store = await cookies();
  store.set(
    ACTOR_COOKIE,
    signActor({ ...actor, exp: Date.now() + ACTOR_TTL_MS }, actorSecret()),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/dashboard",
      maxAge: ACTOR_TTL_MS / 1000,
    },
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors in `app/dashboard/actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/actions.ts
git commit -m "feat(dashboard): server actions for unlock, transitions and stock"
```

---

## Task 8: The unlock screen

**Files:**
- Create: `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/unlock/page.tsx`
- Create: `components/dashboard/PinPad.tsx`, `components/dashboard/StaffBar.tsx`

**Interfaces:**
- Consumes: `roster`, `currentStaff`, `currentActor` (Task 6); `unlockAction`, `lockAction` (Task 7); `ROLE_LABELS` (Task 4)
- Produces: the `/dashboard` shell; `StaffBar` (used by every dashboard page)

**Design:** the KDS canvas — `bg-kds-canvas text-kds-text-primary`. The roster is
a hairline-divided list of full-width rows, exactly the `MenuRow` pattern
inverted: name in serif at `clamp(28px,3.2vw,44px)`, role in mono-uppercase
`10px` at `tracking-[0.18em]`. The keypad is a 3×4 grid of near-square hairline
cells, mono `24px`, no radius. PIN progress uses `●` / `○` — the same glyph
vocabulary as `PunchCard`, already in the codebase.

- [ ] **Step 1: Write the shell**

`app/dashboard/layout.tsx`:

```tsx
import type { Metadata } from "next";

import { StaffBar } from "@/components/dashboard/StaffBar";
import { currentActor, currentStaff } from "@/lib/staff";

export const metadata: Metadata = {
  title: "Pass — KROMA",
  // Unlinked from the storefront and out of every index. Surface reduction,
  // not a security control.
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [station, actor] = await Promise.all([currentStaff(), currentActor()]);

  return (
    <div className="min-h-dvh bg-kds-canvas text-kds-text-primary">
      <StaffBar
        stationName={station?.display_name ?? "Unknown station"}
        actorName={actor?.name ?? null}
      />
      <main className="pt-14">{children}</main>
    </div>
  );
}
```

`app/dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function DashboardIndex() {
  redirect("/dashboard/board");
}
```

- [ ] **Step 2: Write `StaffBar`**

`components/dashboard/StaffBar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { lockAction } from "@/app/dashboard/actions";
import { ConnectionPill } from "@/components/dashboard/ConnectionPill";
import { pressSpring } from "@/lib/motion";

/**
 * Who is unlocked, where, and whether the board is still hearing from the
 * server. Fixed at h-14 — one line shorter than the storefront header, because
 * a bar screen owes every pixel to the orders.
 */
export function StaffBar({
  stationName,
  actorName,
}: {
  stationName: string;
  actorName: string | null;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-4 border-b border-kds-border bg-kds-canvas px-5 sm:px-10 lg:px-14">
      <div className="flex items-baseline gap-3">
        <span className="font-serif text-[22px] leading-none tracking-[-0.02em]">
          KROMA
        </span>
        <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
          {stationName}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <ConnectionPill />

        {actorName ? (
          <motion.form action={lockAction} whileTap={{ scale: 0.98 }} transition={pressSpring}>
            <button
              type="submit"
              className="flex h-9 items-center rounded-full border border-kds-border px-4 font-mono text-[10px] font-medium tracking-[0.18em] uppercase transition-colors hover:border-kds-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              {actorName} — hand over
            </button>
          </motion.form>
        ) : (
          <Link
            href="/dashboard/unlock"
            className="flex h-9 items-center rounded-full bg-accent-primary px-4 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
          >
            Unlock
          </Link>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Write `PinPad`**

`components/dashboard/PinPad.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Delete } from "lucide-react";

import { unlockAction } from "@/app/dashboard/actions";
import { pressSpring, spring } from "@/lib/motion";
import { ROLE_LABELS, type StaffRole } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";

type RosterEntry = { id: string; display_name: string; role: StaffRole };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

/**
 * Pick a name, type four digits. Two steps rather than a PIN alone, because a
 * bare PIN is both collision-prone across a roster and gives the person no
 * confirmation of who the terminal thinks they are.
 */
export function PinPad({ roster }: { roster: RosterEntry[] }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState<RosterEntry | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function press(key: string) {
    setError(null);
    if (key === "del") return setPin((p) => p.slice(0, -1));
    if (pin.length >= 4) return;

    const next = pin + key;
    setPin(next);
    if (next.length === 4 && picked) submit(picked.id, next);
  }

  function submit(staffId: string, value: string) {
    startTransition(async () => {
      const result = await unlockAction(staffId, value);
      if (result.ok) {
        router.push("/dashboard/board");
        router.refresh();
      } else {
        setPin("");
        setError(result.error ?? "That PIN is not right.");
      }
    });
  }

  if (!picked) {
    return (
      <section aria-label="Who is on" className="px-5 sm:px-10 lg:px-14">
        <p className="pt-10 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
          Who is on
        </p>

        {roster.length === 0 ? (
          <p className="my-10 border-y border-kds-border py-10 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
            Nobody on the roster yet.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-kds-border border-y border-kds-border">
            {roster.map((person) => (
              <li key={person.id}>
                <motion.button
                  type="button"
                  onClick={() => setPicked(person)}
                  whileTap={{ scale: 0.995 }}
                  transition={pressSpring}
                  className="flex w-full items-baseline justify-between gap-6 py-7 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kds-text-primary sm:py-9"
                >
                  <span className="font-serif text-[clamp(28px,3.2vw,44px)] leading-[1.05] tracking-[-0.02em]">
                    {person.display_name}
                  </span>
                  <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
                    {ROLE_LABELS[person.role]}
                  </span>
                </motion.button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section aria-label={`PIN for ${picked.display_name}`} className="px-5 sm:px-10 lg:px-14">
      <button
        type="button"
        onClick={() => {
          setPicked(null);
          setPin("");
          setError(null);
        }}
        className="pt-10 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase transition-colors hover:text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
      >
        ← Not {picked.display_name}
      </button>

      <p className="mt-6 font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em]">
        {picked.display_name}
      </p>

      {/* Same glyphs as the punchcard: filled is what you have entered. */}
      <p aria-hidden className="mt-7 flex gap-3 text-[28px] leading-none">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? "text-accent-primary" : "text-kds-border"}>
            {i < pin.length ? "●" : "○"}
          </span>
        ))}
      </p>

      <p role="status" className="mt-4 h-4 font-mono text-[11px] tracking-[0.14em] uppercase">
        <AnimatePresence mode="wait">
          {error && (
            <motion.span
              key={error}
              initial={reduced ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring}
              className="text-badge-alert"
            >
              {error}
            </motion.span>
          )}
        </AnimatePresence>
      </p>

      <div className="mt-8 grid max-w-[360px] grid-cols-3 border-t border-l border-kds-border">
        {KEYS.map((key, i) =>
          key === "" ? (
            <div key={i} className="aspect-4/3 border-r border-b border-kds-border" />
          ) : (
            <motion.button
              key={i}
              type="button"
              disabled={pending}
              onClick={() => press(key)}
              whileTap={{ scale: 0.97 }}
              transition={pressSpring}
              aria-label={key === "del" ? "Delete last digit" : key}
              className={cn(
                "flex aspect-4/3 items-center justify-center border-r border-b border-kds-border",
                "font-mono text-[24px] tabular-nums transition-colors",
                "hover:bg-kds-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kds-text-primary",
                "disabled:text-kds-text-secondary",
              )}
            >
              {key === "del" ? <Delete size={20} aria-hidden /> : key}
            </motion.button>
          ),
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write the unlock page**

`app/dashboard/unlock/page.tsx`:

```tsx
import { PinPad } from "@/components/dashboard/PinPad";
import { roster } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function UnlockPage() {
  return <PinPad roster={await roster()} />;
}
```

- [ ] **Step 5: Verify by hand**

Run: `pnpm dev`. Seed an owner (`select claim_owner('Ana');` while signed in),
then insert a barista with a known PIN:

```sql
insert into staff (display_name, role, pin_hash)
values ('Ana', 'staff', crypt('1234', gen_salt('bf', 10)));
```

Visit `/dashboard/unlock`. Expected: roster lists Ana; picking her shows the pad;
`1234` redirects to the board; `0000` clears the dots and shows
"That PIN is not right."; five bad tries show the lockout message.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/layout.tsx app/dashboard/page.tsx app/dashboard/unlock/page.tsx components/dashboard/PinPad.tsx components/dashboard/StaffBar.tsx
git commit -m "feat(dashboard): staff shell and PIN unlock"
```

---

## Task 9: The age spine and the order row

**Files:**
- Create: `components/dashboard/AgeSpine.tsx`, `components/dashboard/OrderRow.tsx`
- Create: `types/board.ts`

**Interfaces:**
- Consumes: `ageTier`, `ageFraction`, `elapsedLabel`, `AGE_TONES` (Task 6); `NEXT_STATUS` (Task 4)
- Produces: type `BoardOrder`; `AgeSpine`, `OrderRow`

**Design — the signature.** Every row carries a 2px vertical rule at its left
edge. The rule's filled portion grows with wait time and its colour steps
`kds-text-secondary → accent-primary → badge-alert` at five and ten minutes.
It replaces the coloured card border every other KDS uses with the hairline
vocabulary this brand already speaks. Nothing else on the row is coloured by
age except the timer itself — one accessory, worn once.

- [ ] **Step 1: Write the shared type**

`types/board.ts`:

```ts
import type { OrderStatus } from "@/lib/order-status";

/** Exactly what staff_order() returns. Keep the two in step. */
export type BoardOrder = {
  id: string;
  order_number: number;
  status: OrderStatus;
  customer_name: string | null;
  bar_name: string | null;
  avoid_allergens: string[];
  is_regular: number;
  notes: string | null;
  subtotal: number;
  total: number;
  payment_method: "online" | "counter";
  placed_at: string;
  pickup_at: string | null;
  started_at: string | null;
  ready_at: string | null;
  collected_at: string | null;
  claimed_by: string | null;
  items: BoardOrderItem[];
};

export type BoardOrderItem = {
  item_name: string;
  menu_item_id: string | null;
  quantity: number;
  selected_modifiers: { group: string; option: string; priceOffset: number }[];
  line_total: number;
  /** The item ran out after this order was paid for. */
  gone: boolean;
};
```

- [ ] **Step 2: Write `AgeSpine`**

```tsx
"use client";

import { ageFraction, ageTier, AGE_TONES } from "@/lib/order-age";
import { cn } from "@/lib/utils";

/**
 * The signature element. A 2px rule down the left edge of every row whose fill
 * grows with the wait and whose colour steps at five and ten minutes.
 *
 * Deliberately not a progress bar and not a coloured card border: this brand
 * builds structure from single-pixel rules, so urgency is expressed in the
 * same vocabulary. Height is the only thing that animates, and it animates via
 * transform (scaleY) so nothing lays out twice.
 */
export function AgeSpine({ since, now }: { since: Date; now: Date }) {
  const tier = ageTier(since, now);
  const fill = ageFraction(since, now);

  return (
    <span
      aria-hidden
      className="relative block w-[2px] shrink-0 self-stretch bg-kds-border"
    >
      <span
        className={cn(
          "absolute inset-x-0 bottom-0 origin-bottom transition-colors duration-300",
          AGE_TONES[tier].spine,
        )}
        style={{ height: "100%", transform: `scaleY(${fill})` }}
      />
    </span>
  );
}
```

- [ ] **Step 3: Write `OrderRow`**

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { AgeSpine } from "@/components/dashboard/AgeSpine";
import { spring, pressSpring } from "@/lib/motion";
import { AGE_TONES, ageTier, elapsedLabel } from "@/lib/order-age";
import { NEXT_STATUS } from "@/lib/order-transitions";
import { cn } from "@/lib/utils";

import type { BoardOrder } from "@/types/board";

/** Which stamp the row is counting from — the age of the CURRENT state. */
function since(order: BoardOrder): Date {
  const stamp =
    order.status === "ready"
      ? order.ready_at
      : order.status === "preparing"
        ? order.started_at
        : order.placed_at;
  return new Date(stamp ?? order.placed_at);
}

export function OrderRow({
  order,
  now,
  onAdvance,
  disabled,
}: {
  order: BoardOrder;
  now: Date;
  onAdvance: (order: BoardOrder) => void;
  /** Offline, or nobody has unlocked the terminal. */
  disabled: boolean;
}) {
  const from = since(order);
  const tone = AGE_TONES[ageTier(from, now)];
  const next = NEXT_STATUS[order.status];
  const gone = order.items.some((item) => item.gone);

  return (
    <motion.li
      layout="position"
      layoutId={`order-${order.id}`}
      transition={{ layout: spring }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: "easeOut" } }}
      className="flex gap-4"
    >
      <AgeSpine since={from} now={now} />

      <div className="min-w-0 flex-1 py-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-mono text-[28px] leading-none font-medium tabular-nums">
            {order.order_number}
          </span>
          <span className={cn("font-mono text-[15px] tabular-nums", tone.text)}>
            {elapsedLabel(from, now)}
          </span>
        </div>

        <p className="mt-2.5 truncate font-serif text-[22px] leading-[1.05] tracking-[-0.02em]">
          {order.bar_name ?? order.customer_name ?? "Guest"}
        </p>

        <ul className="mt-4 space-y-1.5">
          {order.items.map((item, i) => (
            <li key={i} className="font-mono text-[11px] tracking-[0.14em] uppercase">
              <span className="tabular-nums">{item.quantity}×</span>{" "}
              <span className={item.gone ? "text-badge-alert" : undefined}>
                {item.item_name}
              </span>
              {item.selected_modifiers.map((modifier) => (
                <span key={modifier.option} className="text-kds-text-secondary">
                  <span aria-hidden className="mx-2 text-kds-border">/</span>
                  {modifier.option}
                </span>
              ))}
            </li>
          ))}
        </ul>

        {(order.avoid_allergens.length > 0 || gone || order.payment_method === "counter") && (
          <p className="mt-4 font-mono text-[10px] font-medium tracking-[0.18em] uppercase">
            {order.status === "pending" && (
              <span className="text-accent-primary">Take payment</span>
            )}
            {gone && (
              <>
                {order.status === "pending" && (
                  <span aria-hidden className="mx-2 text-kds-border">/</span>
                )}
                <span className="text-badge-alert">Contains 86&apos;d item</span>
              </>
            )}
            {order.avoid_allergens.map((allergen) => (
              <span key={allergen} className="text-badge-alert">
                <span aria-hidden className="mx-2 text-kds-border">/</span>
                No {allergen}
              </span>
            ))}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          {next && (
            <motion.button
              type="button"
              disabled={disabled}
              onClick={() => onAdvance(order)}
              whileTap={{ scale: 0.98 }}
              transition={pressSpring}
              aria-label={`Move order ${order.order_number} to ${next}`}
              className="h-10 rounded-full bg-accent-primary px-5 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:bg-kds-surface disabled:text-kds-text-secondary"
            >
              {ADVANCE_LABELS[order.status]}
            </motion.button>
          )}

          <Link
            href={`/dashboard/order/${order.id}`}
            className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase transition-colors hover:text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
          >
            Open
          </Link>
        </div>
      </div>
    </motion.li>
  );
}

/** Operational verbs, not e-commerce ones. */
const ADVANCE_LABELS: Partial<Record<BoardOrder["status"], string>> = {
  pending: "Paid at counter",
  paid: "Start",
  preparing: "On the bar",
  ready: "Collected",
};
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/AgeSpine.tsx components/dashboard/OrderRow.tsx types/board.ts
git commit -m "feat(board): order row with the age spine"
```

---

## Task 10: The live board

**Files:**
- Create: `components/dashboard/ConnectionPill.tsx`, `components/dashboard/OrderLane.tsx`, `components/dashboard/OrderBoard.tsx`
- Create: `app/dashboard/board/page.tsx`
- Create: `lib/use-board.ts`

**Interfaces:**
- Consumes: `BoardOrder` (Task 9), `advanceOrderAction` (Task 7), `createClient` from `lib/client.ts`
- Produces: `useBoard(initial) → { orders, connection, refetch }`, `ConnectionState`

- [ ] **Step 1: Write the realtime hook**

`lib/use-board.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/client";

import type { BoardOrder } from "@/types/board";

export type ConnectionState = "live" | "reconnecting" | "offline";

const POLL_MS = 30_000;

/**
 * The board's data.
 *
 * Subscribes to `orders` ONLY. order_items rows arrive in a separate
 * replication message from their parent insert, so listening to both renders a
 * card with no lines for a few hundred milliseconds on every new order.
 * Instead any event triggers one staff_board() re-fetch — a round trip that is
 * always internally consistent.
 *
 * On reconnect it re-fetches everything rather than replaying deltas: an event
 * missed while the socket was down is otherwise invisible forever.
 */
export function useBoard(initial: BoardOrder[]) {
  const [orders, setOrders] = useState(initial);
  const [connection, setConnection] = useState<ConnectionState>("reconnecting");
  const [freshAt, setFreshAt] = useState(() => new Date());
  const supabase = useRef(createClient());

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.current.rpc("staff_board");
    if (error) {
      setConnection("offline");
      return;
    }
    setOrders((data as BoardOrder[] | null) ?? []);
    setFreshAt(new Date());
  }, []);

  useEffect(() => {
    const client = supabase.current;
    const channel = client
      .channel("board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => void refetch(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("live");
          void refetch();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection("offline");
        } else if (status === "CLOSED") {
          setConnection("reconnecting");
        }
      });

    return () => void client.removeChannel(channel);
  }, [refetch]);

  // While the socket is down, poll. Slowly — this is a fallback, not a design.
  useEffect(() => {
    if (connection === "live") return;
    const id = setInterval(() => void refetch(), POLL_MS);
    return () => clearInterval(id);
  }, [connection, refetch]);

  return { orders, connection, freshAt, refetch };
}
```

- [ ] **Step 2: Write `ConnectionPill`**

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

import { useBoardConnection } from "@/components/dashboard/OrderBoard";
import { cn } from "@/lib/utils";

/**
 * Always on screen. A board that silently stops updating loses orders and
 * loses trust permanently, so this never hides when everything is fine — the
 * green dot IS the reassurance.
 */
export function ConnectionPill() {
  const reduced = useReducedMotion();
  const { connection, freshAt } = useBoardConnection();

  const label =
    connection === "live"
      ? "Live"
      : connection === "reconnecting"
        ? "Reconnecting"
        : `Offline — ${freshAt.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}`;

  const tone =
    connection === "live"
      ? "text-badge-live"
      : connection === "reconnecting"
        ? "text-accent-primary"
        : "text-badge-alert";

  return (
    <p
      role="status"
      className={cn(
        "flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.18em] uppercase",
        tone,
      )}
    >
      <motion.span
        aria-hidden
        className="size-1.5 rounded-full bg-current"
        animate={reduced || connection !== "live" ? undefined : { opacity: [1, 0.25, 1] }}
        transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
      />
      {label}
    </p>
  );
}
```

- [ ] **Step 3: Write `OrderLane`**

```tsx
"use client";

import { AnimatePresence } from "framer-motion";

import { OrderRow } from "@/components/dashboard/OrderRow";

import type { BoardOrder } from "@/types/board";

/**
 * One column of the pass. Columns are split by a left hairline rather than a
 * gap, and rows are divided by hairlines rather than being cards — the same
 * two rules the storefront's menu list follows.
 */
export function OrderLane({
  title,
  orders,
  now,
  onAdvance,
  disabled,
}: {
  title: string;
  orders: BoardOrder[];
  now: Date;
  onAdvance: (order: BoardOrder) => void;
  disabled: boolean;
}) {
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col border-kds-border lg:border-l lg:first:border-l-0"
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-kds-border px-5 py-4">
        <h2 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
          {title}
        </h2>
        <span className="font-mono text-[12px] tabular-nums text-kds-text-secondary">
          {orders.length}
        </span>
      </header>

      {orders.length === 0 ? (
        <p className="px-5 py-10 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
          Nothing on the pass in this section.
        </p>
      ) : (
        <ul className="divide-y divide-kds-border overflow-y-auto px-5">
          <AnimatePresence initial={false}>
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                now={now}
                onAdvance={onAdvance}
                disabled={disabled}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Write `OrderBoard`**

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { LayoutGroup } from "framer-motion";

import { advanceOrderAction } from "@/app/dashboard/actions";
import { OrderLane } from "@/components/dashboard/OrderLane";
import { NEXT_STATUS } from "@/lib/order-transitions";
import { useBoard, type ConnectionState } from "@/lib/use-board";

import type { BoardOrder } from "@/types/board";

const ConnectionContext = createContext<{
  connection: ConnectionState;
  freshAt: Date;
}>({ connection: "reconnecting", freshAt: new Date() });

export function useBoardConnection() {
  return useContext(ConnectionContext);
}

const LANES: { title: string; statuses: BoardOrder["status"][] }[] = [
  { title: "On the pass", statuses: ["pending", "paid"] },
  { title: "Brewing", statuses: ["preparing"] },
  { title: "Ready at the bar", statuses: ["ready"] },
  { title: "Collected", statuses: ["collected"] },
];

export function OrderBoard({
  initial,
  unlocked,
}: {
  initial: BoardOrder[];
  unlocked: boolean;
}) {
  const { orders, connection, freshAt, refetch } = useBoard(initial);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  // One clock for every timer and every spine, so nothing ticks out of step.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  async function advance(order: BoardOrder) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    const result = await advanceOrderAction(order.id, next);
    if (!result.ok) setError(result.error ?? "That did not go through.");
    void refetch();
  }

  // Writes are refused while the socket is down. Queuing them for replay would
  // leave two iPads to reconcile divergent order state on reconnect, which is
  // far worse than ten minutes on paper.
  const disabled = connection === "offline" || !unlocked;

  return (
    <ConnectionContext.Provider value={{ connection, freshAt }}>
      <div className="px-5 pt-4 sm:px-10 lg:px-14">
        {disabled && (
          <p
            role="status"
            className="border-y border-kds-border py-4 font-mono text-[11px] tracking-[0.14em] uppercase"
          >
            {connection === "offline" ? (
              <span className="text-badge-alert">
                Offline — the board is showing the last state it heard. Print the pass
                list and work from paper.
              </span>
            ) : (
              <span className="text-accent-primary">
                Unlock with your PIN to move an order.
              </span>
            )}
          </p>
        )}

        {error && (
          <p role="status" className="py-4 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase">
            {error}
          </p>
        )}
      </div>

      <LayoutGroup>
        <div className="grid grid-cols-1 lg:grid-cols-4">
          {LANES.map((lane) => (
            <OrderLane
              key={lane.title}
              title={lane.title}
              orders={orders.filter((order) => lane.statuses.includes(order.status))}
              now={now}
              onAdvance={advance}
              disabled={disabled}
            />
          ))}
        </div>
      </LayoutGroup>

      <div className="px-5 py-8 sm:px-10 lg:px-14 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase transition-colors hover:text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
        >
          Print pass list
        </button>
      </div>
    </ConnectionContext.Provider>
  );
}
```

- [ ] **Step 5: Write the board page**

`app/dashboard/board/page.tsx`:

```tsx
import { OrderBoard } from "@/components/dashboard/OrderBoard";
import { createClient } from "@/lib/server";
import { currentActor } from "@/lib/staff";

import type { BoardOrder } from "@/types/board";

// The board is live by definition; there is nothing here worth caching.
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const supabase = await createClient();
  const [{ data }, actor] = await Promise.all([
    supabase.rpc("staff_board"),
    currentActor(),
  ]);

  return (
    <OrderBoard
      initial={(data as BoardOrder[] | null) ?? []}
      unlocked={Boolean(actor)}
    />
  );
}
```

- [ ] **Step 6: Verify by hand**

Run: `pnpm dev`. Place an order through the storefront, then watch
`/dashboard/board`.
Expected: the order appears without a refresh; the pill reads `LIVE`; tapping
`Start` moves it to Brewing and the row animates across; killing the network
flips the pill to `OFFLINE — HH:MM` and greys every button.

- [ ] **Step 7: Commit**

```bash
git add lib/use-board.ts components/dashboard/ConnectionPill.tsx components/dashboard/OrderLane.tsx components/dashboard/OrderBoard.tsx app/dashboard/board/page.tsx
git commit -m "feat(board): live order board over Supabase Realtime"
```

---

## Task 11: One order, in full

**Files:**
- Create: `app/dashboard/order/[id]/page.tsx`, `components/dashboard/OrderDetail.tsx`

**Interfaces:**
- Consumes: `staff_order` (Task 3), `advanceOrderAction` / `noteOrderAction` (Task 7), `currentActor` (Task 6), `staffCan` (Task 4)
- Produces: nothing later tasks depend on

- [ ] **Step 1: Write the page**

```tsx
import { notFound } from "next/navigation";

import { OrderDetail } from "@/components/dashboard/OrderDetail";
import { createClient } from "@/lib/server";
import { currentActor } from "@/lib/staff";

import type { BoardOrder } from "@/types/board";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, actor] = await Promise.all([
    supabase.rpc("staff_order", { p_order_id: id }),
    currentActor(),
  ]);

  if (!order) notFound();

  // Manager-only, and reading it is itself an event. A barista does not need a
  // phone number to make a cortado.
  const { data: events } = actor
    ? await supabase
        .from("staff_events")
        .select("action, created_at, detail, staff:staff_id(display_name)")
        .eq("subject_id", id)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: null };

  return (
    <OrderDetail
      order={order as BoardOrder}
      role={actor?.role ?? null}
      events={events ?? []}
    />
  );
}
```

- [ ] **Step 2: Write `OrderDetail`**

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { advanceOrderAction, noteOrderAction } from "@/app/dashboard/actions";
import { pressSpring } from "@/lib/motion";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { staffCan, type StaffRole } from "@/lib/staff-permissions";

import type { BoardOrder } from "@/types/board";

type Event = {
  action: string;
  created_at: string;
  detail: Record<string, unknown>;
  staff: { display_name: string } | null;
};

export function OrderDetail({
  order,
  role,
  events,
}: {
  order: BoardOrder;
  role: StaffRole | null;
  events: Event[];
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canVoid = role ? staffCan(role, "order.void") : false;
  const canRefund = role ? staffCan(role, "order.refund") : false;

  async function settle(to: BoardOrder["status"]) {
    const result = await advanceOrderAction(order.id, to);
    if (!result.ok) setError(result.error ?? "That did not go through.");
  }

  return (
    <article className="px-5 py-10 sm:px-10 lg:px-14">
      <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
        {ORDER_STATUS_LABELS[order.status].text}
      </p>

      <div className="mt-4 flex items-baseline justify-between gap-6">
        <h1 className="font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em]">
          {order.bar_name ?? order.customer_name ?? "Guest"}
        </h1>
        <span className="font-mono text-[28px] font-medium tabular-nums">
          {order.order_number}
        </span>
      </div>

      <p className="mt-4 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
        {order.payment_method === "online" ? "Paid online" : "Counter"}
        <span aria-hidden className="mx-3 text-kds-border">/</span>
        €{order.total.toFixed(2)}
        <span aria-hidden className="mx-3 text-kds-border">/</span>
        {order.is_regular} collected before
      </p>

      <ul className="mt-10 divide-y divide-kds-border border-y border-kds-border">
        {order.items.map((item, i) => (
          <li key={i} className="flex items-baseline justify-between gap-6 py-5">
            <div className="min-w-0">
              <p className="font-serif text-[22px] leading-[1.05] tracking-[-0.02em]">
                <span className="tabular-nums">{item.quantity}×</span> {item.item_name}
              </p>
              {item.selected_modifiers.length > 0 && (
                <p className="mt-2.5 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
                  {item.selected_modifiers.map((modifier, j) => (
                    <span key={modifier.option}>
                      {j > 0 && <span aria-hidden className="mx-3 text-kds-border">/</span>}
                      {modifier.option}
                    </span>
                  ))}
                </p>
              )}
              {item.gone && (
                <p className="mt-2.5 font-mono text-[10px] tracking-[0.18em] text-badge-alert uppercase">
                  Gone for today
                </p>
              )}
            </div>
            <span className="font-mono text-[15px] tabular-nums">
              €{item.line_total.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mt-8 max-w-lg text-[15px] leading-[1.6] text-kds-text-secondary whitespace-pre-line">
          {order.notes}
        </p>
      )}

      <form
        className="mt-8 flex max-w-lg gap-3"
        action={async () => {
          const result = await noteOrderAction(order.id, note);
          if (result.ok) setNote("");
          else setError(result.error ?? "That did not go through.");
        }}
      >
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a note — oat instead of whole"
          aria-label="Add a note to this order"
          className="h-10 flex-1 border-b border-kds-border bg-transparent font-sans text-[15px] placeholder:text-kds-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
        />
        <button
          type="submit"
          className="h-10 shrink-0 rounded-full border border-kds-border px-5 font-mono text-[10px] font-medium tracking-[0.18em] uppercase transition-colors hover:border-kds-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
        >
          Add note
        </button>
      </form>

      {(canVoid || canRefund) && (
        <div className="mt-10 flex flex-wrap gap-3 border-t border-kds-border pt-8">
          {canVoid && order.status !== "collected" && (
            <motion.button
              type="button"
              onClick={() => settle("cancelled")}
              whileTap={{ scale: 0.98 }}
              transition={pressSpring}
              className="h-10 rounded-full border border-badge-alert px-5 font-mono text-[10px] font-medium tracking-[0.18em] text-badge-alert uppercase transition-colors hover:bg-badge-alert hover:text-surface-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              Void — stock returns
            </motion.button>
          )}
          {canRefund && order.status === "collected" && (
            <motion.button
              type="button"
              onClick={() => settle("refunded")}
              whileTap={{ scale: 0.98 }}
              transition={pressSpring}
              className="h-10 rounded-full border border-badge-alert px-5 font-mono text-[10px] font-medium tracking-[0.18em] text-badge-alert uppercase transition-colors hover:bg-badge-alert hover:text-surface-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              Refund — stock stays gone
            </motion.button>
          )}
        </div>
      )}

      {error && (
        <p role="status" className="mt-4 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase">
          {error}
        </p>
      )}

      {events.length > 0 && (
        <section aria-label="What happened" className="mt-14">
          <h2 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
            What happened
          </h2>
          <ul className="mt-6 divide-y divide-kds-border border-y border-kds-border">
            {events.map((event, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-6 py-4 font-mono text-[11px] tracking-[0.14em] uppercase"
              >
                <span>
                  {event.staff?.display_name ?? "System"}
                  <span aria-hidden className="mx-3 text-kds-border">/</span>
                  <span className="text-kds-text-secondary">{event.action}</span>
                </span>
                <span className="shrink-0 text-kds-text-secondary tabular-nums">
                  {new Date(event.created_at).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
```

- [ ] **Step 3: Verify by hand**

Run: `pnpm dev`, open an order from the board.
Expected: lines and modifiers render; a note appends and shows the author's
name; a `staff` actor sees no Void button; a manager does; the audit list shows
each transition newest first.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/order components/dashboard/OrderDetail.tsx
git commit -m "feat(dashboard): order detail with notes, settle actions and audit"
```

---

## Task 12: Lint, typecheck, full suite

**Files:**
- Modify: whatever the checks flag

- [ ] **Step 1: Run the whole test suite**

Run: `node --test lib/*.test.ts`
Expected: every test passes, including the pre-existing cart, checkout, dietary,
order-history, order-status and password suites.

- [ ] **Step 2: Run both SQL suites**

Run: `supabase db reset && for f in supabase/tests/*.test.sql; do psql "$DATABASE_URL" -f "$f"; done`
Expected: every file prints its `NOTICE` and no assertion fails. `card.test.sql`
and `create_order.test.sql` must still pass — the `card_punches` change touched
them.

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: succeeds. `/dashboard/*` routes appear as dynamic.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(dashboard): typecheck, lint and test fixes"
```

---

## Self-Review

**Spec coverage:**

| Spec § | Task |
| :--- | :--- |
| §6 identity model | 1 |
| §7 sessions | 1 (`staff_unlock`), 5 (cookie), 7 (`unlockAction`) |
| §8 permissions | 1 (`staff_can`), 4 (mirror) |
| §9 defence in depth | 1 (RLS), 3 (fresh role read), 6 (proxy gate) |
| §10 bootstrap | 1 (`claim_owner`) |
| §11 audit | 1 (table), 3 (writes), 11 (display) |
| §12 lifecycle | 2, 3, 4 |
| §13 board | 9, 10 |
| §14 customer data | 3 (`staff_order` projection), 9 (allergens on the row) |
| §15 scenarios | 3 (`gone` flag, void/refund stock), 9 (86 marker, take payment), 10 (offline, print) |
| §16 routes | 8, 10, 11 |
| §19 testing | 1, 3, 4, 5, 6, 12 |
| §20 migration ordering | 1, 2, 3 in that order |

Deferred to spec C, as designed: `/dashboard/menu`, `/dashboard/staff`,
`/dashboard/settings`. Deferred to spec D: `/dashboard/numbers`. The Stripe
refund call named in §15.6 is deliberately **not** in this plan — `advance_order`
records the refund and the money is moved from the Stripe dashboard until spec C
ships the ops surface. A `ponytail:` comment marks it.

**Placeholder scan:** clean — every step carries real SQL, TSX or a command.

**Type consistency:** `BoardOrder` (Task 9) matches the `staff_order()`
projection (Task 3) field for field. `StaffRole` and `StaffAction` (Task 4) are
used unchanged in Tasks 5, 6, 7 and 11. `ConnectionState` (Task 10) is produced
by `useBoard` and consumed by `ConnectionPill` through `useBoardConnection`.
`advanceOrderAction(orderId, to)` has the same signature in Tasks 7, 10 and 11.
