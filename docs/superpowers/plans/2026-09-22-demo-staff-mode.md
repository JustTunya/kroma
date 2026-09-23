# M2 — Public Demo Staff Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reviewer who never touches a terminal can reach `/dashboard` through a
published "Try the staff side" link, use the real KDS/stock/close-of-day flow
against a shared sandbox account, and have any damage undone automatically
every night — with `pnpm seed:demo` making the dashboard look lived-in from
the first visit.

**Architecture:** One migration adds an `is_demo` flag to `staff` and a
service-role-only `reset_demo_day()` RPC, plus a guard clause in the five RPCs
that gate `menu.edit`/`order.refund`. The existing daily cron calls
`reset_demo_day()` before it opens the shop. The login page gains a
client-side "sign in as the demo account" action using published, non-secret
credentials. A standalone Node script backfills realistic historical orders
and customers directly (bypassing the request-time RPCs, which all stamp
`now()`) so the demo dashboard has real-looking history instead of an empty
shop.

**Tech Stack:** Next.js 16 / React 19 (existing app), Supabase Postgres
(`plpgsql` RPCs, RLS), `@supabase/supabase-js` (already a dependency, used
directly in the seed script — no new devDependency), Node's built-in
`node:test` for unit tests (existing convention), the repo's existing
`do $$ ... assert ... $$` style for `supabase/tests/*.sql`.

**Spec:** `docs/superpowers/specs/2026-09-22-demo-staff-mode-design.md`

## Global Constraints

- Copy follows `CLAUDE.md` §1: short declaratives, no exclamation marks, no
  e-commerce language ("Gone for today" not "Sold out", etc.). The demo's own
  error message — `'Shared sandbox — refunds and menu edits are disabled
  here.'` — is the only new user-facing copy and must not drift from this.
- `staff_can()` stays the single permissions authority; the demo cap is
  layered on top of it at specific call sites, never inside it (see spec §2
  for why).
- No new npm dependency for the seed script — `@supabase/supabase-js` is
  already installed.
- SQL migrations follow the existing convention: a new file per logical
  change, `create or replace function` for any RPC being modified, comments
  explaining *why*, `revoke all ... grant execute ...` lines at the end of
  the file for any new function.
- Every RPC that already checks `v_actor.id is null or not v_actor.is_active
  or v_actor.kind <> 'person'` before a permission check keeps doing so —
  the demo guard is additive, inserted after the existing `staff_can` check,
  never replacing it.

---

### Task 1: Migration — `is_demo` flag, abuse-capping guards, `reset_demo_day()`, `admin_upsert_demo_staff()`

**Files:**
- Create: `supabase/migrations/20260922090000_demo_staff_mode.sql`
- Modify: `types/supabase.ts` (hand-edit to match — this repo has no `gen types` script wired up; every other migration's types were added by hand the same way)
- Create: `supabase/tests/demo_mode.test.sql`

**Interfaces:**
- Produces: `staff.is_demo boolean` column; RPCs `reset_demo_day() returns void` and `admin_upsert_demo_staff(p_user_id uuid, p_pin text) returns staff`, both service-role-only (same access pattern as `release_expired_orders()`).
- Consumes: existing `staff`, `orders`, `service_days`, `staff_events` tables and the `shop_tz()` function (`supabase/migrations/20260823100000_manage_numbers.sql`).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260922090000_demo_staff_mode.sql
--
-- M2: a shared, published staff account safe to trash. is_demo marks it;
-- two things change because of it. First, five RPCs that already gate
-- 'menu.edit' or 'order.refund' refuse the demo actor outright — capping
-- abuse by disabling the two destructive actions rather than rate-limiting
-- them, since nothing else in this codebase throttles by request rate.
-- Second, reset_demo_day() clears *today's* orders and lockouts (not
-- history — pnpm seed:demo's backfill is meant to survive resets) so the
-- nightly cron can call it before it opens the shop.

alter table staff add column is_demo boolean not null default false;

-- ---------------------------------------------------------- abuse capping
-- Copied verbatim from 20260901092000_tender_and_close.sql:30-144, with one
-- guard inserted after the existing staff_can check.
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

  -- Demo cap: the shared sandbox account can advance/void/undo orders, but
  -- never refund one.
  if v_actor.is_demo and v_action = 'order.refund' then
    raise exception 'Shared sandbox — refunds and menu edits are disabled here.'
      using errcode = 'P0001';
  end if;

  if v_order.payment_method = 'counter' and v_order.status = 'pending' and p_to = 'paid' then
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
                             when p_to in ('pending','paid','preparing')
                               then null
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

-- Copied verbatim from 20260901093000_menu_admin.sql:53-179, same guard.
create or replace function menu_upsert(p_actor uuid, p_item jsonb)
returns menu_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  staff;
  v_id     uuid := nullif(p_item ->> 'id', '')::uuid;
  v_before menu_items;
  v_after  menu_items;
  v_slug   text;
  v_diff   jsonb := '{}'::jsonb;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;
  if not staff_can(v_actor.role, 'menu.edit') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;
  if v_actor.is_demo then
    raise exception 'Shared sandbox — refunds and menu edits are disabled here.'
      using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_item ->> 'name'), '') = '' then
    raise exception 'A menu item needs a name.' using errcode = 'P0001';
  end if;
  if (p_item ->> 'base_price')::numeric < 0 then
    raise exception 'Price cannot be negative.' using errcode = 'P0001';
  end if;
  if not valid_modifiers(coalesce(p_item -> 'modifiers', '[]'::jsonb)) then
    raise exception 'That modifier group is not shaped right.' using errcode = 'P0001';
  end if;

  v_slug := nullif(btrim(p_item ->> 'slug'), '');
  if v_slug is null then
    v_slug := menu_slug(p_item ->> 'name');
  end if;

  if v_id is not null then
    select * into v_before from menu_items where id = v_id;
    if v_before.id is null then
      raise exception 'No such item.' using errcode = 'P0001';
    end if;
  end if;

  update menu_items
     set category_id  = (p_item ->> 'category_id')::uuid,
         slug          = v_slug,
         name          = btrim(p_item ->> 'name'),
         description   = nullif(btrim(coalesce(p_item ->> 'description', '')), ''),
         base_price    = (p_item ->> 'base_price')::numeric,
         daily_stock   = case when p_item ? 'daily_stock'
                               then nullif(p_item ->> 'daily_stock', '')::integer
                               else daily_stock end,
         par_stock     = case when p_item ? 'par_stock'
                               then nullif(p_item ->> 'par_stock', '')::integer
                               else par_stock end,
         dietary_tags  = case when p_item ? 'dietary_tags'
                               then coalesce((select array_agg(value #>> '{}')
                                                from jsonb_array_elements(p_item -> 'dietary_tags')), '{}')
                               else dietary_tags end,
         allergens     = case when p_item ? 'allergens'
                               then coalesce((select array_agg(value #>> '{}')
                                                from jsonb_array_elements(p_item -> 'allergens')), '{}')
                               else allergens end,
         modifiers     = coalesce(p_item -> 'modifiers', '[]'::jsonb),
         image_url     = case when p_item ? 'image_url'
                               then nullif(p_item ->> 'image_url', '') else image_url end,
         is_active     = coalesce((p_item ->> 'is_active')::boolean, is_active),
         updated_at    = now()
   where id = v_id
  returning * into v_after;

  if not found then
    insert into menu_items (category_id, slug, name, description, base_price,
                            daily_stock, par_stock, dietary_tags, allergens,
                            modifiers, image_url, is_active)
    values ((p_item ->> 'category_id')::uuid,
            v_slug,
            btrim(p_item ->> 'name'),
            nullif(btrim(coalesce(p_item ->> 'description', '')), ''),
            (p_item ->> 'base_price')::numeric,
            nullif(p_item ->> 'daily_stock', '')::integer,
            nullif(p_item ->> 'par_stock', '')::integer,
            coalesce((select array_agg(value #>> '{}')
                        from jsonb_array_elements(coalesce(p_item -> 'dietary_tags', '[]'::jsonb))), '{}'),
            coalesce((select array_agg(value #>> '{}')
                        from jsonb_array_elements(coalesce(p_item -> 'allergens', '[]'::jsonb))), '{}'),
            coalesce(p_item -> 'modifiers', '[]'::jsonb),
            nullif(p_item ->> 'image_url', ''),
            coalesce((p_item ->> 'is_active')::boolean, true))
    returning * into v_after;
  end if;

  if v_before.name is distinct from v_after.name then
    v_diff := v_diff || jsonb_build_object('name', jsonb_build_object('from', v_before.name, 'to', v_after.name));
  end if;
  if v_before.base_price is distinct from v_after.base_price then
    v_diff := v_diff || jsonb_build_object('base_price', jsonb_build_object('from', v_before.base_price, 'to', v_after.base_price));
  end if;
  if v_before.category_id is distinct from v_after.category_id then
    v_diff := v_diff || jsonb_build_object('category_id', jsonb_build_object('from', v_before.category_id, 'to', v_after.category_id));
  end if;
  if v_before.daily_stock is distinct from v_after.daily_stock then
    v_diff := v_diff || jsonb_build_object('daily_stock', jsonb_build_object('from', v_before.daily_stock, 'to', v_after.daily_stock));
  end if;
  if v_before.par_stock is distinct from v_after.par_stock then
    v_diff := v_diff || jsonb_build_object('par_stock', jsonb_build_object('from', v_before.par_stock, 'to', v_after.par_stock));
  end if;
  if v_before.is_active is distinct from v_after.is_active then
    v_diff := v_diff || jsonb_build_object('is_active', jsonb_build_object('from', v_before.is_active, 'to', v_after.is_active));
  end if;
  if v_before.description is distinct from v_after.description then
    v_diff := v_diff || jsonb_build_object('description', jsonb_build_object('from', v_before.description, 'to', v_after.description));
  end if;
  if v_before.modifiers is distinct from v_after.modifiers then
    v_diff := v_diff || jsonb_build_object('modifiers', jsonb_build_object('from', v_before.modifiers, 'to', v_after.modifiers));
  end if;

  insert into staff_events (staff_id, action, subject_id, detail)
  values (p_actor, 'menu.edit', v_after.id, v_diff);

  return v_after;
end;
$$;

-- Copied verbatim from 20260901093000_menu_admin.sql:183-212, same guard.
create or replace function menu_reorder(p_actor uuid, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor staff;
  v_count integer;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;
  if not staff_can(v_actor.role, 'menu.edit') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;
  if v_actor.is_demo then
    raise exception 'Shared sandbox — refunds and menu edits are disabled here.'
      using errcode = 'P0001';
  end if;

  update menu_items
     set sort_order = t.idx - 1
    from unnest(p_ids) with ordinality as t(id, idx)
   where menu_items.id = t.id;
  get diagnostics v_count = row_count;

  insert into staff_events (staff_id, action, subject_id, detail)
  values (p_actor, 'menu.reorder', null, jsonb_build_object('ids', to_jsonb(p_ids)));

  return v_count;
end;
$$;

-- Copied verbatim from 20260901093000_menu_admin.sql:216-269, same guard.
create or replace function menu_category_upsert(p_actor uuid, p_category jsonb)
returns menu_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor staff;
  v_id    uuid := nullif(p_category ->> 'id', '')::uuid;
  v_slug  text;
  v_after menu_categories;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;
  if not staff_can(v_actor.role, 'menu.edit') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;
  if v_actor.is_demo then
    raise exception 'Shared sandbox — refunds and menu edits are disabled here.'
      using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_category ->> 'name'), '') = '' then
    raise exception 'A category needs a name.' using errcode = 'P0001';
  end if;

  v_slug := nullif(btrim(p_category ->> 'slug'), '');
  if v_slug is null then
    v_slug := menu_slug(p_category ->> 'name');
  end if;

  update menu_categories
     set slug        = v_slug,
         name        = btrim(p_category ->> 'name'),
         vat_rate    = coalesce((p_category ->> 'vat_rate')::numeric, vat_rate),
         earns_punch = coalesce((p_category ->> 'earns_punch')::boolean, earns_punch),
         is_active   = coalesce((p_category ->> 'is_active')::boolean, is_active)
   where id = v_id
  returning * into v_after;

  if not found then
    insert into menu_categories (slug, name, vat_rate, earns_punch, is_active)
    values (v_slug,
            btrim(p_category ->> 'name'),
            coalesce((p_category ->> 'vat_rate')::numeric, 0.110),
            coalesce((p_category ->> 'earns_punch')::boolean, false),
            coalesce((p_category ->> 'is_active')::boolean, true))
    returning * into v_after;
  end if;

  insert into staff_events (staff_id, action, subject_id, detail)
  values (p_actor, 'menu.category_edit', v_after.id, to_jsonb(v_after));

  return v_after;
end;
$$;

-- Copied verbatim from 20260902090000_menu_item_delete.sql, same guard.
create or replace function menu_item_delete(p_actor uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor staff;
  v_item  menu_items;
begin
  select * into v_actor from staff where id = p_actor;
  if v_actor.id is null or not v_actor.is_active or v_actor.kind <> 'person' then
    raise exception 'Not on shift.' using errcode = 'P0001';
  end if;
  if not staff_can(v_actor.role, 'menu.edit') then
    raise exception 'Not yours to do.' using errcode = 'P0001';
  end if;
  if v_actor.is_demo then
    raise exception 'Shared sandbox — refunds and menu edits are disabled here.'
      using errcode = 'P0001';
  end if;

  delete from menu_items where id = p_id returning * into v_item;
  if v_item.id is null then
    raise exception 'No such item.' using errcode = 'P0001';
  end if;

  insert into staff_events (staff_id, action, subject_id, detail)
  values (p_actor, 'menu.delete', v_item.id, jsonb_build_object('name', v_item.name));
end;
$$;

-- --------------------------------------------------------------- nightly reset
-- Service-role only: called from the cron route, never from the client. Only
-- today's orders go — history from pnpm seed:demo (or a genuinely prior day)
-- stays, so the dashboard's close-of-day and "past orders" pages keep looking
-- lived-in across resets.
create function reset_demo_day()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone shop_tz())::date;
  v_demo  staff;
begin
  select * into v_demo from staff where is_demo limit 1;

  delete from orders where (placed_at at time zone shop_tz())::date = v_today;
  delete from service_days where day = v_today;

  if v_demo.id is not null then
    update staff
       set failed_pins = 0, locked_until = null
     where id = v_demo.id;

    insert into staff_events (staff_id, action, detail)
    values (v_demo.id, 'demo.reset', jsonb_build_object('day', v_today));
  end if;
end;
$$;

revoke all on function reset_demo_day() from public, anon, authenticated;
grant execute on function reset_demo_day() to service_role;

-- ----------------------------------------------------- demo staff bootstrap
-- What pnpm seed:demo calls once it has created (or found) the demo Auth
-- user, to link it to a staff row with a known PIN. Idempotent via
-- upsert on the unique user_id — safe to re-run to rotate the PIN.
create function admin_upsert_demo_staff(p_user_id uuid, p_pin text)
returns staff
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row staff;
begin
  insert into staff (user_id, display_name, role, kind, pin_hash, is_active, is_demo)
  values (p_user_id, 'Demo Owner', 'owner', 'person',
          extensions.crypt(p_pin, extensions.gen_salt('bf')), true, true)
  on conflict (user_id) do update
     set pin_hash     = excluded.pin_hash,
         is_active    = true,
         is_demo      = true,
         failed_pins  = 0,
         locked_until = null
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function admin_upsert_demo_staff(uuid, text) from public, anon, authenticated;
grant execute on function admin_upsert_demo_staff(uuid, text) to service_role;
```

- [ ] **Step 2: Hand-edit `types/supabase.ts`**

Add `is_demo: boolean` to the `staff` table's `Row` (line ~500), `Insert`
(line ~514, as `is_demo?: boolean`), and `Update` (line ~528, as
`is_demo?: boolean`) blocks, and to `current_staff`'s `Returns` shape (line
~659, as `is_demo: boolean`) — it returns a full `staff` row and every other
column is duplicated there too.

Add two new entries to the `Functions` block (near `release_expired_orders`,
line ~831), matching that entry's shape:

```typescript
reset_demo_day: { Args: never; Returns: undefined }
admin_upsert_demo_staff: {
  Args: { p_user_id: string; p_pin: string }
  Returns: {
    created_at: string
    display_name: string
    failed_pins: number
    id: string
    is_active: boolean
    is_demo: boolean
    kind: string
    locked_until: string | null
    pin_hash: string | null
    role: Database["public"]["Enums"]["staff_role"]
    station: string
    updated_at: string
    user_id: string | null
  }
}
```

- [ ] **Step 3: Write the pgTAP-style test**

```sql
-- supabase/tests/demo_mode.test.sql
begin;

do $$
declare
  v_demo    uuid;
  v_manager uuid;
  v_cat     uuid;
  v_order   orders;
begin
  insert into staff (display_name, role, is_demo) values ('Test Demo Owner', 'owner', true)
  returning id into v_demo;
  insert into staff (display_name, role) values ('Test Manager', 'manager')
  returning id into v_manager;

  insert into menu_categories (slug, name) values ('test-demo-mode', 'Test Demo Mode')
  returning id into v_cat;

  -- the demo actor cannot edit the menu
  begin
    perform menu_upsert(v_demo, jsonb_build_object('name','X','base_price',1,
      'category_id', v_cat, 'modifiers', '[]'::jsonb));
    assert false, 'the demo actor may not edit the menu';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'Shared sandbox — refunds and menu edits are disabled here.',
           'and is told this is the shared sandbox';
  end;

  -- a real manager still can, on the same function
  perform menu_upsert(v_manager, jsonb_build_object('name','Test Item','base_price',1,
    'category_id', v_cat, 'modifiers', '[]'::jsonb));
  assert exists (select 1 from menu_items where name = 'Test Item'),
         'a non-demo actor is unaffected by the guard';

  -- the demo actor cannot delete a menu item either
  begin
    perform menu_item_delete(v_demo, (select id from menu_items where name = 'Test Item'));
    assert false, 'the demo actor may not delete a menu item';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'Shared sandbox — refunds and menu edits are disabled here.';
  end;

  -- reset_demo_day clears today's orders but not an older one
  insert into service_days (day, opened_by) values (current_date, v_demo);
  insert into orders (status, payment_method, subtotal, total, service_day, day_number)
  values ('collected', 'counter', 5, 5, current_date, 1)
  returning * into v_order;

  insert into service_days (day, opened_by, closed_at)
  values (current_date - 1, v_demo, now() - interval '1 day');
  insert into orders (status, payment_method, subtotal, total, service_day, day_number, placed_at)
  values ('collected', 'counter', 5, 5, current_date - 1, 1, now() - interval '1 day');

  perform reset_demo_day();

  assert not exists (select 1 from orders where id = v_order.id),
         'today''s order is gone after reset';
  assert not exists (select 1 from service_days where day = current_date),
         'today''s service day is gone after reset';
  assert exists (select 1 from orders where service_day = current_date - 1),
         'yesterday''s order survives the reset';
  assert exists (select 1 from service_days where day = current_date - 1),
         'yesterday''s service day survives the reset';

  -- reset_demo_day clears a PIN lockout on the demo staff row
  update staff set failed_pins = 5, locked_until = now() + interval '15 minutes'
   where id = v_demo;
  perform reset_demo_day();
  assert (select locked_until from staff where id = v_demo) is null,
         'the demo staff row''s lockout clears on reset';

  -- admin_upsert_demo_staff is idempotent and hashes the PIN
  perform admin_upsert_demo_staff(gen_random_uuid(), '1234');
  raise notice 'demo_mode: all assertions passed';
end $$;

rollback;
```

- [ ] **Step 4: Run the test**

Run: `supabase test db`
Expected: every file in `supabase/tests/`, including `demo_mode.test.sql`,
passes — no `assert` failures, no unhandled exceptions.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260922090000_demo_staff_mode.sql types/supabase.ts supabase/tests/demo_mode.test.sql
git commit -m "feat(demo): is_demo flag, refund/menu-edit capping, reset_demo_day RPC"
```

---

### Task 2: Wire `reset_demo_day()` into the nightly cron

**Files:**
- Modify: `app/api/cron/release-holds/route.ts`

**Interfaces:**
- Consumes: `reset_demo_day()` from Task 1 (via `admin().rpc("reset_demo_day")`).

- [ ] **Step 1: Call `reset_demo_day()` before the shop opens**

```typescript
// app/api/cron/release-holds/route.ts
import { admin } from "@/lib/admin";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  // Runs before the shop opens: clears today's orders and any PIN lockout on
  // the demo staff account, so vandalism from the day before never survives
  // into today's open. History from pnpm seed:demo is untouched.
  const { error: resetError } = await admin().rpc("reset_demo_day");
  if (resetError) console.error("reset_demo_day failed:", resetError.message);

  const { data, error } = await admin().rpc("release_expired_orders");

  if (error) {
    console.error("release_expired_orders failed:", error.message);
    return new Response("failed", { status: 500 });
  }

  const { data: opener } = await admin()
    .from("staff")
    .select("id")
    .eq("kind", "person")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (opener) {
    const { error: openError } = await admin().rpc("open_service", { p_actor: opener.id });
    if (openError) console.error("open_service failed:", openError.message);
  }

  const { error: sweepError } = await admin()
    .from("order_push_subscriptions")
    .delete()
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (sweepError) console.error("push subscription sweep failed:", sweepError.message);

  return Response.json({ released: data });
}
```

- [ ] **Step 2: Verify manually**

There is no route-handler test harness in this repo (grep confirms zero
`app/**/*.test.ts`) — every existing cron/API route is verified by hand, so
this one follows suit.

Run: `supabase start` (if not already running), then in a second terminal
`pnpm dev`, then:

```bash
curl -i -X GET http://localhost:3000/api/cron/release-holds \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected: `200` with a JSON body `{"released": <number>}`, and the terminal
running `pnpm dev` shows no `reset_demo_day failed` line. Re-running the
same command a second time immediately after must not error either (idempotent
even with nothing to reset).

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/release-holds/route.ts
git commit -m "feat(demo): reset today's demo data before the nightly shop-open"
```

---

### Task 3: "Try the staff side" login + published demo credentials

**Files:**
- Modify: `app/auth/login/page.tsx`
- Modify: `.env.local.example`
- Modify: `README.md` (the "Trying it live" section, `README.md:120-134`)

**Interfaces:**
- Consumes: `NEXT_PUBLIC_DEMO_STAFF_EMAIL`, `NEXT_PUBLIC_DEMO_STAFF_PASSWORD`,
  `NEXT_PUBLIC_DEMO_STAFF_PIN` (new env vars — `NEXT_PUBLIC_` because a
  client component needs them to call `signInWithPassword`, and per spec
  these are meant to be published, not secret).
- Produces: nothing new for later tasks — this is the user-facing entry
  point Task 1/2's machinery exists to support.

- [ ] **Step 1: Add the demo sign-in action to the login page**

```tsx
// app/auth/login/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AuthHeader,
  AuthNote,
  Field,
  FormError,
  SocialAuth,
  Submit,
} from "@/components/auth/AuthForm";
import { createClient } from "@/lib/client";

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_STAFF_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_STAFF_PASSWORD;
const DEMO_PIN = process.env.NEXT_PUBLIC_DEMO_STAFF_PIN;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [demoPending, setDemoPending] = useState(false);
  const router = useRouter();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    router.push("/account");
    router.refresh();
  };

  const handleDemoStaffLogin = async () => {
    if (!DEMO_EMAIL || !DEMO_PASSWORD) return;
    setDemoPending(true);
    setError(null);

    const { error } = await createClient().auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (error) {
      setError(error.message);
      setDemoPending(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <>
      <AuthHeader eyebrow="Account" title="Sign in to order ahead.">
        Past orders, saved regulars, and a shorter wait at the bar.
      </AuthHeader>

      <form onSubmit={handleLogin} className="grid gap-[clamp(0.75rem,2.2vh,1.5rem)]">
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint={
            <Link
              href="/auth/forgot-password"
              className="font-mono text-[10px] font-medium tracking-[0.14em] text-text-tertiary uppercase underline underline-offset-4 transition-colors hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              Forgotten
            </Link>
          }
        />

        <FormError message={error} />

        <Submit pending={pending}>{pending ? "Signing in" : "Sign in"}</Submit>
      </form>

      <SocialAuth next="/account" />

      {DEMO_EMAIL && DEMO_PASSWORD && DEMO_PIN ? (
        <p className="mt-[clamp(1.25rem,3.2vh,2rem)] border-t border-hairline pt-[clamp(0.875rem,2.4vh,1.5rem)] font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
          Curious about the staff side?{" "}
          <button
            type="button"
            onClick={handleDemoStaffLogin}
            disabled={demoPending}
            className="text-text-primary underline underline-offset-4 transition-colors hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:text-text-tertiary"
          >
            {demoPending ? "Signing in" : `Try the staff side — PIN ${DEMO_PIN}`}
          </button>
        </p>
      ) : null}

      <AuthNote href="/auth/sign-up" action="Create one">
        No account yet
      </AuthNote>
    </>
  );
}
```

- [ ] **Step 2: Add the env vars to `.env.local.example`**

```bash
# .env.local.example — append after the STAFF_SESSION_SECRET block
# Published sandbox credentials for the "Try the staff side" link on the
# login page — not secret on purpose (see ROADMAP.md M2). Leave unset to
# hide the link entirely.
NEXT_PUBLIC_DEMO_STAFF_EMAIL=
NEXT_PUBLIC_DEMO_STAFF_PASSWORD=
NEXT_PUBLIC_DEMO_STAFF_PIN=
```

- [ ] **Step 3: Update the README's "Trying it live" section**

Replace the paragraph at `README.md:130-134` (the one explaining the PIN is
deliberately unpublished) with:

```markdown
`/dashboard` is the staff side (order board, kitchen display, stock, close of
day). It's gated behind a real account and a 4-digit PIN like any real
deployment would be — but this one is a demo, so the login page has a
published "Try the staff side" link that signs into a shared sandbox
account. Every visitor shares it; that account cannot refund an order or
edit the menu, and anything else it touches resets every night.
```

- [ ] **Step 4: Verify manually**

With `NEXT_PUBLIC_DEMO_STAFF_EMAIL`/`_PASSWORD`/`_PIN` left blank in
`.env.local`, load `/auth/login` and confirm the "Try the staff side" line
does not render. Fill them in with the values Task 4 will provision (or any
placeholder for now), reload, click the link, and confirm it attempts a sign-in
(will fail with "Invalid login credentials" until Task 4's account exists —
that failure surfacing through `FormError` is the expected behavior at this
point in the plan).

- [ ] **Step 5: Commit**

```bash
git add app/auth/login/page.tsx .env.local.example README.md
git commit -m "feat(demo): add the published Try the staff side login"
```

---

### Task 4: `pnpm seed:demo` — bootstrap the demo staff account

**Files:**
- Create: `scripts/seed-demo.mjs`
- Modify: `package.json` (add the `seed:demo` script)

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_DEMO_STAFF_EMAIL`, `NEXT_PUBLIC_DEMO_STAFF_PASSWORD`,
  `NEXT_PUBLIC_DEMO_STAFF_PIN` from the environment; `admin_upsert_demo_staff`
  RPC from Task 1.
- Produces: `ensureDemoStaff(client)` exported from `scripts/seed-demo.mjs`
  — returns `{ id: string }` (the demo staff row). Task 5 imports this.

- [ ] **Step 1: Write the bootstrap script**

```javascript
// scripts/seed-demo.mjs
//
// pnpm seed:demo — idempotent. Run once locally after `supabase start`, or
// once against a hosted project to provision + backfill the public demo.
// Re-running is safe: staff bootstrap upserts, history generation skips
// itself once any order exists (see seedHistory in this same file).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_STAFF_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_STAFF_PASSWORD;
const DEMO_PIN = process.env.NEXT_PUBLIC_DEMO_STAFF_PIN;

function requireEnv() {
  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY],
    ["NEXT_PUBLIC_DEMO_STAFF_EMAIL", DEMO_EMAIL],
    ["NEXT_PUBLIC_DEMO_STAFF_PASSWORD", DEMO_PASSWORD],
    ["NEXT_PUBLIC_DEMO_STAFF_PIN", DEMO_PIN],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}

export async function ensureDemoStaff(client) {
  const { data: existing } = await client
    .from("staff")
    .select("id, user_id")
    .eq("is_demo", true)
    .maybeSingle();

  let userId = existing?.user_id;

  if (userId) {
    // Keep the Auth password in sync with whatever the env now says —
    // cheap, and means rotating the published password is a one-command fix.
    const { error } = await client.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD,
    });
    if (error) throw new Error(`updateUserById failed: ${error.message}`);
  } else {
    const { data, error } = await client.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser failed: ${error.message}`);
    userId = data.user.id;
  }

  const { data: staffRow, error: staffError } = await client.rpc(
    "admin_upsert_demo_staff",
    { p_user_id: userId, p_pin: DEMO_PIN },
  );
  if (staffError) throw new Error(`admin_upsert_demo_staff failed: ${staffError.message}`);

  console.log(`Demo staff ready: ${DEMO_EMAIL} / PIN ${DEMO_PIN} (staff id ${staffRow.id})`);
  return { id: staffRow.id };
}

async function main() {
  requireEnv();
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const demoStaff = await ensureDemoStaff(client);
  console.log(`demoStaff ready: ${demoStaff.id}`);
  // Task 5 appends seedHistory() below this line and adds the call here —
  // it does not exist yet, so main() does not call it in this task.
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Add the `seed:demo` script to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "seed:demo": "node scripts/seed-demo.mjs"
  }
}
```

- [ ] **Step 3: Verify manually**

Run `supabase start` if it isn't already, fill `NEXT_PUBLIC_DEMO_STAFF_EMAIL`/
`_PASSWORD`/`_PIN` in `.env.local` with real values (e.g.
`demo@kroma.coffee` / a throwaway password / `4242`), export the four
required vars from `.env.local` into the shell (or use `dotenv -e .env.local
--`, whichever this repo's contributors already do for one-off scripts — a
plain `export $(grep -v '^#' .env.local | xargs)` works too), then:

```bash
pnpm seed:demo
```

Expected: script exits 0, prints `Demo staff ready: ... (staff id ...)`, and
throws its "Missing env vars" error immediately (before touching the network)
if any of the five vars are unset. Run it a second time immediately after —
expected: same success output, no duplicate-user error (the `existing` branch
takes over).

Then in the browser, `/auth/login` → the "Try the staff side" link now signs
in successfully and lands on `/dashboard`'s PIN pad; entering the published
PIN unlocks it.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-demo.mjs package.json
git commit -m "feat(demo): pnpm seed:demo bootstraps the shared staff account"
```

---

### Task 5: `pnpm seed:demo` — realistic historical customers and orders

**Files:**
- Modify: `scripts/seed-demo.mjs` (adds `seedHistory`, referenced by Task 4's `main()`)

**Interfaces:**
- Consumes: `ensureDemoStaff` (Task 4, same file); `service_report` RPC
  (`supabase/migrations/20260901092000_tender_and_close.sql:152`).
- Produces: nothing further downstream — this is the plan's last code task.

- [ ] **Step 1: Add the historical data generator**

```javascript
// scripts/seed-demo.mjs — appended after ensureDemoStaff, before main()

const HISTORY_DAYS = 30;
const CUSTOMER_COUNT = 10;

const FIRST_NAMES = [
  "Ana", "Mihai", "Ioana", "Andrei", "Elena", "Cristian", "Maria", "Radu",
  "Alexandra", "Bogdan", "Diana", "Vlad",
];
const LAST_NAMES = [
  "Pop", "Ionescu", "Popescu", "Rusu", "Stan", "Dumitrescu", "Marin",
  "Constantin", "Toma", "Barbu",
];
const GUEST_NAMES = [
  "Sofia", "Matei", "Larisa", "Tudor", "Gabriela", "Robert", "Irina",
  "Alex", "Nicoleta", "Dan",
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[randomInt(0, list.length - 1)];
}

function weightedPick(items, weightOf) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

// A small coffee shop's basket composition: drinks far outweigh bakehouse,
// which outweighs the small kitchen menu.
const CATEGORY_WEIGHT = {
  "espresso-bar": 5,
  "tea-alternatives": 2,
  bakehouse: 2.5,
  kitchen: 1,
};

function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function serviceHours(date) {
  return isWeekend(date) ? { open: 8.5, close: 17 } : { open: 7.5, close: 18 };
}

function hourWeight(hour, weekend) {
  if (weekend) {
    if (hour >= 9 && hour < 12) return 3;
    if (hour >= 12 && hour < 14) return 2;
    return 1;
  }
  if (hour >= 7 && hour < 9) return 3;
  if (hour >= 12 && hour < 13) return 2;
  if (hour >= 14 && hour < 16) return 0.6;
  return 1;
}

function randomHour(date) {
  const { open, close } = serviceHours(date);
  const weekend = isWeekend(date);
  const hours = [];
  for (let h = open; h < close; h += 0.25) hours.push(h);
  return weightedPick(hours, (h) => hourWeight(Math.floor(h), weekend));
}

function priceLine(item, categoryById) {
  let price = Number(item.base_price);
  const modifiers = [];
  for (const group of item.modifiers ?? []) {
    const option = pick(group.options);
    price += Number(option.priceOffset ?? 0);
    modifiers.push({
      group: group.name,
      option: option.name,
      priceOffset: option.priceOffset ?? 0,
    });
  }
  const category = categoryById.get(item.category_id);
  return {
    modifiers,
    unitPrice: Math.round(price * 100) / 100,
    vatRate: Number(category?.vat_rate ?? 0.19),
    earnsPunch: Boolean(category?.earns_punch),
  };
}

async function seedHistory(client, demoStaffId) {
  const { count } = await client.from("orders").select("id", { count: "exact", head: true });
  if (count && count > 0) {
    console.log(`seedHistory: ${count} orders already exist, skipping backfill.`);
    return;
  }

  const { data: items, error: itemsError } = await client
    .from("menu_items")
    .select("id, name, base_price, category_id, modifiers")
    .eq("is_active", true);
  if (itemsError) throw new Error(`menu_items fetch failed: ${itemsError.message}`);

  const { data: categories, error: catError } = await client
    .from("menu_categories")
    .select("id, slug, vat_rate, earns_punch");
  if (catError) throw new Error(`menu_categories fetch failed: ${catError.message}`);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const weightedItems = items.map((item) => {
    const slug = categoryById.get(item.category_id)?.slug;
    return { item, weight: CATEGORY_WEIGHT[slug] ?? 1 };
  });

  // Fake customers: a handful of frequent regulars (index 0-2) and the rest
  // occasional, so punch cards and "is_regular" both have something real to
  // show.
  const customers = [];
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const email = `${firstName}.${lastName}.${i}@demo.kroma.coffee`.toLowerCase();
    const { data, error } = await client.auth.admin.createUser({
      email,
      password: `demo-customer-${i}-${Math.random().toString(36).slice(2)}`,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser (${email}) failed: ${error.message}`);

    await client.from("profiles").insert({
      id: data.user.id,
      display_name: `${firstName} ${lastName}`,
      bar_name: firstName,
      marketing_opt_in: Math.random() < 0.5,
    });

    const favourites = weightedItems
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, randomInt(1, 3));
    for (const { item } of favourites) {
      await client.from("favourites").insert({ user_id: data.user.id, menu_item_id: item.id });
    }

    customers.push({
      userId: data.user.id,
      name: `${firstName} ${lastName}`,
      regular: i < 3,
      punches: 0,
    });
  }

  const today = new Date();
  for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo--) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - daysAgo);
    const dayStr = day.toISOString().slice(0, 10);
    const weekend = isWeekend(day);
    const orderCount = weekend ? randomInt(45, 70) : randomInt(35, 55);

    const { error: openError } = await client.from("service_days").insert({
      day: dayStr,
      opened_by: demoStaffId,
      opened_at: `${dayStr}T${weekend ? "08:30" : "07:30"}:00Z`,
      next_number: orderCount + 1,
      float_cash: 200,
    });
    if (openError) throw new Error(`service_days insert (${dayStr}) failed: ${openError.message}`);

    for (let n = 1; n <= orderCount; n++) {
      const hour = randomHour(day);
      const placedAt = new Date(day);
      placedAt.setUTCHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);

      const isGuest = Math.random() < 0.55;
      const regularBias = customers.filter((c) => c.regular);
      const customer = isGuest
        ? null
        : Math.random() < 0.5 && regularBias.length > 0
          ? pick(regularBias)
          : pick(customers);

      const lineCount = randomInt(1, 3);
      const lines = [];
      let subtotal = 0;
      let tax = 0;
      for (let i = 0; i < lineCount; i++) {
        const { item } = weightedPick(weightedItems, (w) => w.weight);
        const quantity = Math.random() < 0.15 ? 2 : 1;
        const priced = priceLine(item, categoryById);
        const lineTotal = Math.round(priced.unitPrice * quantity * 100) / 100;
        subtotal += lineTotal;
        tax += Math.round(lineTotal * priced.vatRate * 100) / 100;
        lines.push({
          menu_item_id: item.id,
          item_name: item.name,
          base_price: item.base_price,
          quantity,
          selected_modifiers: priced.modifiers,
          line_total: lineTotal,
          earns_punch: priced.earnsPunch,
          vat_rate: priced.vatRate,
          _punches: priced.earnsPunch ? quantity : 0,
        });
      }

      const isOnline = Math.random() < 0.2;
      const settledAs = isOnline ? "online" : Math.random() < 0.45 ? "cash" : "card";
      const roll = Math.random();
      const status = roll < 0.9 ? "collected" : roll < 0.95 ? "cancelled" : roll < 0.98 ? "refunded" : "abandoned";

      let redeemedLine = null;
      if (customer) {
        customer.punches += lines.reduce((sum, l) => sum + l._punches, 0);
        if (customer.punches >= 10 && lines.length > 0) {
          redeemedLine = lines[0];
          subtotal -= redeemedLine.line_total;
          tax -= Math.round(redeemedLine.line_total * redeemedLine.vat_rate * 100) / 100;
          redeemedLine.line_total = 0;
          customer.punches -= 10;
        }
      }

      subtotal = Math.round(subtotal * 100) / 100;
      tax = Math.round(Math.max(tax, 0) * 100) / 100;

      const { data: order, error: orderError } = await client
        .from("orders")
        .insert({
          status,
          customer_name: customer ? null : pick(GUEST_NAMES),
          user_id: customer?.userId ?? null,
          subtotal,
          total: subtotal,
          tax_total: tax,
          payment_method: isOnline ? "online" : "counter",
          settled_as: status === "cancelled" ? null : settledAs,
          placed_at: placedAt.toISOString(),
          collected_at: status === "collected" ? placedAt.toISOString() : null,
          service_day: dayStr,
          day_number: n,
        })
        .select()
        .single();
      if (orderError) throw new Error(`order insert failed: ${orderError.message}`);

      const { error: lineError } = await client.from("order_items").insert(
        lines.map(({ _punches, ...line }) => ({ ...line, order_id: order.id })),
      );
      if (lineError) throw new Error(`order_items insert failed: ${lineError.message}`);

      if (redeemedLine && customer) {
        const { error: redeemError } = await client.from("card_redemptions").insert({
          user_id: customer.userId,
          order_id: order.id,
          item_name: redeemedLine.item_name,
        });
        if (redeemError) throw new Error(`card_redemptions insert failed: ${redeemError.message}`);
      }
    }

    const { data: report, error: reportError } = await client.rpc("service_report", {
      p_actor: demoStaffId,
      p_day: dayStr,
    });
    if (reportError) throw new Error(`service_report (${dayStr}) failed: ${reportError.message}`);

    const expectedCash = Number(report.expected_cash ?? 0);
    const { error: closeError } = await client
      .from("service_days")
      .update({
        closed_at: `${dayStr}T18:30:00Z`,
        closed_by: demoStaffId,
        counted_cash: Math.round((expectedCash + (Math.random() - 0.5) * 4) * 100) / 100,
        count_detail: {},
        report,
      })
      .eq("day", dayStr);
    if (closeError) throw new Error(`service_days close (${dayStr}) failed: ${closeError.message}`);

    console.log(`seedHistory: ${dayStr} — ${orderCount} orders, closed.`);
  }

  console.log(`seedHistory: backfilled ${HISTORY_DAYS} days for ${CUSTOMER_COUNT} customers.`);
}
```

- [ ] **Step 2: Wire it into `main()`**

`main()` in Task 4 already calls `seedHistory(client, demoStaff.id)` — confirm
that call is present (it was written in anticipation of this task; if it's
missing, add it now).

- [ ] **Step 3: Verify manually**

Reset the local database so this runs against a clean slate, then seed:

```bash
supabase db reset
pnpm seed:demo
```

Expected: ~30 lines of `seedHistory: YYYY-MM-DD — N orders, closed.`, then
the summary line, then exit 0. Run `pnpm seed:demo` a second time — expected:
`seedHistory: <N> orders already exist, skipping backfill.` (the staff
bootstrap from Task 4 still runs and logs its own line).

Then in the browser: sign in via "Try the staff side", open `/dashboard`,
and confirm the order board and `/dashboard/day` (or wherever close-of-day
history lives) show real-looking history — multiple days, non-zero takings,
a mix of cash/card/online. Open `/account` as one of the seeded customer
emails (via Supabase Studio's Auth panel to grab a magic link, or by
resetting that customer's password) and confirm "past orders" and the punch
card show real data.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-demo.mjs
git commit -m "feat(demo): backfill realistic customers, orders, and service days"
```

---

### Task 6: Docs and ROADMAP wrap-up

**Files:**
- Modify: `README.md` (the "Running locally" section, `README.md:136-169`)
- Modify: `ROADMAP.md` (tick M2's boxes)

**Interfaces:** none — this is documentation only, and it closes the plan.

- [ ] **Step 1: Update the README's "Running locally" section**

After the existing numbered PIN-linking steps (`README.md:160-168`), add:

```markdown
Or skip steps 1-3 entirely: `pnpm seed:demo` provisions the same staff
account non-interactively (reading `NEXT_PUBLIC_DEMO_STAFF_EMAIL`/`_PASSWORD`/
`_PIN` from `.env.local`) and backfills 30 days of realistic orders so the
dashboard isn't empty. Safe to re-run.
```

- [ ] **Step 2: Tick M2's boxes in `ROADMAP.md`**

```markdown
- [x] **A. Public demo staff mode.** A "Try the staff side" link on the login page that signs into a sandbox staff account with a published PIN, against a demo shop that is safe to trash. Add a nightly reset (extend the existing cron) so vandalism heals itself.
- [x] Cap abuse on the demo: rate-limit or disable destructive actions (menu delete, refunds) for the demo account.
```

(Leave the unchecked **B. Recorded walkthrough** line as-is — it was the
explicitly-declined backup option, not part of this plan.)

- [ ] **Step 3: Full manual smoke test (M2's exit criterion)**

Run through, on a fresh `supabase db reset` + `pnpm seed:demo` + `pnpm dev`:
1. `/auth/login` → "Try the staff side — PIN ####" is visible and correct.
2. Click it → lands on `/dashboard`'s PIN pad, signed in.
3. Enter the PIN → dashboard unlocks, board shows today (empty or whatever
   local orders exist) plus the 30-day history is reachable from wherever
   the day/close-of-day view lives.
4. Attempt a refund on any collected order → rejected with "Shared sandbox —
   refunds and menu edits are disabled here."
5. Attempt a menu edit (price change or delete) → same rejection.
6. Advancing an order through the board (pending → paid → preparing → ready →
   collected) still works.
7. `curl` the cron route with `CRON_SECRET` (as in Task 2) → 200, and a
   second immediate call also 200.

Expected: every step matches its "Expected" above; nothing throws an
unhandled error in the browser console or the `pnpm dev` terminal.

- [ ] **Step 4: Commit**

```bash
git add README.md ROADMAP.md
git commit -m "docs: document pnpm seed:demo and tick M2"
```
