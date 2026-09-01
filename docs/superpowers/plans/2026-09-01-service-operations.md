# Service Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give KROMA a trading day — opened and closed deliberately, with stock and ticket numbers scoped to it, a countable drawer, an editable menu, a VAT-correct receipt, ready notifications, and manager discounts.

**Architecture:** Every write stays on the established path: a Next.js server action verifies the signed actor cookie, then calls one `security definer` RPC that does the state change, the audit row and the stock movement in a single transaction. `service_days` becomes the scope every money read groups by. `staff_can()` remains the sole permission authority, gaining `shop.open` and `shop.close`; `lib/staff-permissions.ts` mirrors it only to hide buttons.

**Tech Stack:** Next.js 16 App Router · React 19 · Supabase (Postgres + RLS) · Framer Motion 13 · Tailwind v4 · Stripe · `web-push` · Resend HTTP API · `node --test`

**Spec:** `docs/superpowers/specs/2026-09-01-service-operations-design.md`

## Global Constraints

- **Storefront tokens only.** `bg-surface-canvas`, `text-text-secondary`, `border-hairline`, `kds-*`. Never the shadcn semantic tokens (`bg-background`, `text-muted-foreground`, `bg-primary`). CLAUDE.md §2.
- **The mono rule.** Every label, eyebrow, badge, pill, price, timestamp and spec line is uppercase mono with wide tracking. Sans is only for descriptive sentences. CLAUDE.md §3.
- **Tracking ladder:** `0.18em` eyebrows/status pills · `0.16em` nav pills · `0.14em` spec lines/stat lists · `0.02em` prices and counts · `-0.02em` serif headings · `-0.03em` hero display.
- **Radii:** only `rounded-full` (pills, dots), `rounded-sm` (thumbnails), `rounded-lg` (large image frames). Rows, sections and sheets are never rounded. CLAUDE.md §4.
- **Structure is hairlines, not cards.** `divide-y divide-hairline border-y border-hairline` for lists; `md:border-l border-hairline` for column splits. On the KDS canvas the same rules use `kds-border`.
- **Page gutter, invariant:** `px-5 sm:px-10 lg:px-14`.
- **Motion:** import `spring` / `pressSpring` / `numberTransition` from `lib/motion.ts` and `glide` / `rise` / `inView` from `lib/reveal.ts`. Never inline a new spring or easing value. Animate only `opacity` and `transform`. Never mix `duration` with a spring.
- **Reduced motion:** every ambient animation checks `useReducedMotion()` and degrades to a static, still-usable state.
- **Focus:** `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus` (`outline-kds-text-primary` on the KDS canvas), offset `4` on row-sized targets. Never removed.
- **Copy:** short declaratives, concrete numbers, operational language. "Gone for today", not "Sold out". No exclamation marks. CLAUDE.md §1.
- **Prices:** `€${n.toFixed(2)}` with `tabular-nums`, always two decimals.
- **`cn()`** from `lib/utils.ts` for every conditional class.
- **`ponytail:` comments** mark deliberate shortcuts with their upgrade path.
- **Money in SQL is `numeric`,** never `float`. Every computed money value is `round(x, 2)`.
- **Tests:** `node --test lib/x.test.ts` for TypeScript; `begin` / `rollback` SQL files with `do $$ … end $$` assert blocks for the database, matching `supabase/tests/create_order.test.sql`. SQL tests run with `psql "$DATABASE_URL" -f supabase/tests/<file>`.
- **Types:** after every migration, `supabase gen types typescript --local > types/supabase.ts`.

---

## File Structure

**Database — one migration per phase, named for what it does**
- `supabase/migrations/20260901090000_service_day.sql` — `service_days`, order/menu columns, `current_service_day`, `open_service`, `create_order`/`quote_order` guards, backfill, `shop.open`/`shop.close` in `staff_can`
- `supabase/migrations/20260901091000_vat.sql` — `vat_rate` on categories and items, `tax_total` on orders, `order_lines`/`create_order` rewrite, backfill
- `supabase/migrations/20260901092000_tender_and_close.sql` — `settled_as`, `advance_order(p_tender)`, `service_report`, `close_service`
- `supabase/migrations/20260901093000_menu_admin.sql` — `valid_modifiers`, `menu_upsert`, `menu_reorder`, `menu_category_upsert`
- `supabase/migrations/20260901094000_receipts.sql` — `receipt_email`, `receipt_sent_at`, `order_receipt`
- `supabase/migrations/20260901095000_discounts.sql` — `discount_total`, `discount_reason`, `discount_order`
- `supabase/migrations/20260901096000_push.sql` — `order_push_subscriptions`, `subscribe_order_push`
- `supabase/tests/service_day.test.sql`, `close_service.test.sql`, `vat.test.sql`, `menu_admin.test.sql`, `discount.test.sql`

**Library — one file per idea, all pure and unit-tested**
- `lib/service-day.ts` — day-state vocabulary, par-list shaping, variance wording
- `lib/vat.ts` — extract VAT from a gross figure, group by rate
- `lib/cash.ts` — the denomination ladder and the count total
- `lib/menu-admin.ts` — the draft item shape, slugify, modifier validation mirror
- `lib/shop.ts` — the shop's own details, for receipts
- `lib/receipt.ts` — the plain-text receipt body, shared by page and email
- `lib/email.ts` — one `fetch` to Resend
- `lib/discount.ts` — preview a discount against a subtotal
- `lib/push.ts` — send one web-push, server-only

**Server actions**
- `app/dashboard/actions.ts` — extended: `openServiceAction`, `closeServiceAction`, tender on `advanceOrderAction`, `discountOrderAction`
- `app/dashboard/menu/actions.ts` — `saveItemAction`, `reorderItemsAction`, `saveCategoryAction`
- `app/order/actions.ts` — extended: `subscribeToOrderAction`, `setReceiptEmailAction`

**Routes**
- `app/dashboard/day/page.tsx`, `app/dashboard/day/close/page.tsx`
- `app/dashboard/menu/page.tsx`
- `app/order/[token]/receipt/page.tsx`

**Components**
- `components/dashboard/ServiceClosed.tsx`, `components/dashboard/DayPill.tsx`
- `components/dashboard/day/DayReport.tsx`, `components/dashboard/day/CashCount.tsx`
- `components/dashboard/menu/MenuAdminList.tsx`, `components/dashboard/menu/MenuItemSheet.tsx`, `components/dashboard/menu/ModifierEditor.tsx`
- `components/dashboard/DiscountSheet.tsx`
- `components/checkout/NotifyButton.tsx`
- `public/sw.js` — the push service worker

---

# Phase A — The service day

## Task 1: `service_days`, the day columns, and the permission

**Files:**
- Create: `supabase/migrations/20260901090000_service_day.sql`
- Create: `supabase/tests/service_day.test.sql`
- Modify: `lib/staff-permissions.ts:15-30` (the `STAFF_ACTIONS` tuple and the switch)
- Modify: `lib/staff-permissions.test.ts` (add the two new actions)

**Interfaces:**
- Produces: `current_service_day() returns date` · `open_service(p_actor uuid, p_stock jsonb default null) returns service_days` · `service_days` table · `orders.service_day`, `orders.day_number` · `menu_items.par_stock` · `staff_can(role,'shop.open')`, `staff_can(role,'shop.close')`

- [ ] **Step 1: Write the failing SQL test**

Create `supabase/tests/service_day.test.sql`:

```sql
-- Run against the hosted database. Everything is inside begin/rollback:
-- real schema, zero persistence.
begin;

do $$
declare
  v_owner   uuid;
  v_barista uuid;
  v_day     service_days;
  v_item    uuid;
begin
  insert into staff (display_name, role, pin_hash)
  values ('Test Owner', 'owner', extensions.crypt('1111', extensions.gen_salt('bf', 4)))
  returning id into v_owner;

  insert into staff (display_name, role, pin_hash)
  values ('Test Barista', 'staff', extensions.crypt('2222', extensions.gen_salt('bf', 4)))
  returning id into v_barista;

  -- permissions ---------------------------------------------------------------
  assert staff_can('staff', 'shop.open'),        'anyone on shift opens the day';
  assert not staff_can('staff', 'shop.close'),   'a barista does not count the drawer';
  assert staff_can('manager', 'shop.close'),     'a manager counts the drawer';

  -- no day yet ----------------------------------------------------------------
  delete from service_days where day = (now() at time zone shop_tz())::date;
  assert current_service_day() is null, 'no open day before anyone opens one';

  -- a batch item to reset -----------------------------------------------------
  insert into menu_items (category_id, slug, name, base_price, par_stock, daily_stock)
  values ((select id from menu_categories order by sort_order limit 1),
          'test-bun', 'Test Bun', 4.00, 12, 0)
  returning id into v_item;

  -- opening -------------------------------------------------------------------
  v_day := open_service(v_barista);
  assert v_day.day = (now() at time zone shop_tz())::date, 'opens the shop-local day';
  assert v_day.next_number = 1,                            'tickets start at one';
  assert current_service_day() = v_day.day,                'the day is now open';
  assert (select daily_stock from menu_items where id = v_item) = 12,
         'opening resets daily_stock to par';

  -- idempotent ----------------------------------------------------------------
  update menu_items set daily_stock = 3 where id = v_item;
  v_day := open_service(v_barista);
  assert (select daily_stock from menu_items where id = v_item) = 3,
         'a second open writes nothing';
  assert (select count(*) from staff_events where action = 'shop.open') = 1,
         'and audits nothing';

  -- overrides -----------------------------------------------------------------
  delete from service_days where day = (now() at time zone shop_tz())::date;
  v_day := open_service(v_barista, jsonb_build_object(v_item::text, 5));
  assert (select daily_stock from menu_items where id = v_item) = 5,
         'the opening screen count beats par';

  raise notice 'service_day: all assertions passed';
end $$;

rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `psql "$DATABASE_URL" -f supabase/tests/service_day.test.sql`
Expected: FAIL with `relation "service_days" does not exist`

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260901090000_service_day.sql`:

```sql
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

alter table orders
  add column service_day date references service_days(day),
  add column day_number  integer;

create index orders_service_day_idx on orders (service_day, day_number);

-- ------------------------------------------------------------------ backfill
-- Every historical order belongs to a day that really happened. Creating those
-- rows closed, with next_number past their highest ticket, means the sequence
-- is correct if one of them is ever reopened.
insert into service_days (day, opened_at, closed_at, next_number)
select d.day,
       d.first_at,
       d.last_at,
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
  -- morning's sales back to par. Same rule shift_mark() applies to a shift.
  select * into v_row from service_days where day = v_today;
  if found then
    if v_row.closed_at is not null then
      raise exception 'The day is already closed.' using errcode = 'P0001';
    end if;
    return v_row;
  end if;

  insert into service_days (day, opened_by) values (v_today, p_actor)
  returning * into v_row;

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase db reset && psql "$DATABASE_URL" -f supabase/tests/service_day.test.sql`
Expected: `NOTICE: service_day: all assertions passed`

- [ ] **Step 5: Mirror the permissions in TypeScript**

In `lib/staff-permissions.ts`, add `"shop.open"` and `"shop.close"` to `STAFF_ACTIONS`, then in `staffCan`:

```ts
    case "order.abandon":
    // The first person in opens the shop. Same reasoning as item.86.
    case "shop.open":
      return true;
    case "order.void":
    ...
    case "analytics.view":
    // The drawer is money, not bread.
    case "shop.close":
      return MANAGER_UP.includes(role);
```

In `lib/staff-permissions.test.ts` add:

```ts
test("anyone on shift opens the day; only a manager closes it", () => {
  assert.equal(staffCan("staff", "shop.open"), true);
  assert.equal(staffCan("staff", "shop.close"), false);
  assert.equal(staffCan("manager", "shop.close"), true);
  assert.equal(staffCan("owner", "shop.close"), true);
});
```

- [ ] **Step 6: Run the TypeScript test**

Run: `node --test lib/staff-permissions.test.ts`
Expected: PASS

- [ ] **Step 7: Regenerate types and commit**

```bash
supabase gen types typescript --local > types/supabase.ts
git add supabase/migrations/20260901090000_service_day.sql supabase/tests/service_day.test.sql lib/staff-permissions.ts lib/staff-permissions.test.ts types/supabase.ts
git commit -m "feat(day): service_days table, par stock and the shop.open permission"
```

---

## Task 2: Orders belong to a day, and a closed shop refuses them

**Files:**
- Modify: `supabase/migrations/20260901090000_service_day.sql` (append — the migration has not shipped yet)
- Modify: `supabase/tests/create_order.test.sql` (fixtures must open a day)
- Modify: `supabase/tests/order_board.test.sql`, `supabase/tests/order_removal.test.sql`, `supabase/tests/card.test.sql`, `supabase/tests/release_order.test.sql` (same)
- Modify: `supabase/tests/service_day.test.sql` (add the numbering assertions)

**Interfaces:**
- Consumes: `current_service_day()` from Task 1
- Produces: `create_order()` writing `service_day` and `day_number`, raising `'The bakehouse is closed.'`; `quote_order()` raising the same

- [ ] **Step 1: Add the failing assertions**

Append inside the `do $$` block of `supabase/tests/service_day.test.sql`, before the final `raise notice`:

```sql
  -- numbering -----------------------------------------------------------------
  declare
    v_a orders;
    v_b orders;
    v_items jsonb;
  begin
    v_items := jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_item, 'quantity', 1, 'modifiers', '[]'::jsonb));

    v_a := create_order(v_items, 'A', '', 'counter');
    v_b := create_order(v_items, 'B', '', 'counter');

    assert v_a.day_number = 1,                 'the first ticket of the day is 1';
    assert v_b.day_number = 2,                 'the second is 2';
    assert v_a.service_day = current_service_day(), 'the order joins the open day';
    assert v_a.order_number <> v_b.order_number,    'the global id still differs';
  end;

  -- a closed shop refuses -----------------------------------------------------
  update service_days set closed_at = now() where day = current_date;
  begin
    perform create_order(jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_item, 'quantity', 1, 'modifiers', '[]'::jsonb)),
      'C', '', 'counter');
    assert false, 'a closed shop must refuse an order';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'The bakehouse is closed.', 'and say so plainly';
  end;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `psql "$DATABASE_URL" -f supabase/tests/service_day.test.sql`
Expected: FAIL on `the first ticket of the day is 1` (`day_number` is null)

- [ ] **Step 3: Append the guarded `create_order` and `quote_order` to the migration**

```sql
-- ------------------------------------------------------- orders join the day
-- create_order() gains two jobs: refuse when the shop is shut, and take the
-- next ticket number. The `update … returning` is the whole concurrency story —
-- the row lock serialises two checkouts, inside the transaction that was
-- already locking menu_items for stock.
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
  v_user          uuid;
  v_redeem        uuid := null;
  v_redeemed_line jsonb;
  v_day           date;
  v_number        integer;
begin
  if p_payment_method not in ('online', 'counter') then
    raise exception 'Unknown payment method.' using errcode = 'P0001';
  end if;

  -- Before anything is priced or locked: an order with nowhere to land is not
  -- an order, and an online one would arrive with the money already taken.
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
                      payment_method, pickup_at, stripe_session_id,
                      stripe_payment_intent_id, service_day, day_number)
  values (v_user,
          case when p_payment_method = 'online' then 'paid' else 'pending' end::order_status,
          nullif(btrim(left(coalesce(p_customer_name, ''), 80)), ''),
          nullif(btrim(left(coalesce(p_notes, ''), 280)), ''),
          v_subtotal,
          v_subtotal,
          p_payment_method,
          now() + interval '10 minutes',
          p_stripe_session_id,
          p_stripe_payment_intent_id,
          v_day,
          v_number)
  returning * into v_order;

  insert into order_items (order_id, menu_item_id, item_name, base_price,
                           quantity, selected_modifiers, line_total, earns_punch)
  select v_order.id,
         (l ->> 'menu_item_id')::uuid,
         l ->> 'item_name',
         (l ->> 'base_price')::numeric,
         (l ->> 'quantity')::smallint,
         l -> 'selected_modifiers',
         (l ->> 'line_total')::numeric,
         (l ->> 'earns_punch')::boolean
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

-- The quote is what the checkout page prices a card order against, so it has to
-- refuse first — otherwise the customer reaches Stripe and is refunded after.
create or replace function quote_order(p_items jsonb, p_redeem_item_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lines jsonb;
begin
  if current_service_day() is null then
    raise exception 'The bakehouse is closed.' using errcode = 'P0001';
  end if;

  v_lines := order_lines(p_items, false, p_redeem_item_id);

  return jsonb_build_object(
    'lines',    v_lines,
    'subtotal', coalesce((select sum((l ->> 'line_total')::numeric)
                            from jsonb_array_elements(v_lines) as t(l)), 0)
  );
end;
$$;
```

> Check the shipped `quote_order` in `20260819122000_card_redeem.sql:171` before writing this — keep its exact return shape. `lib/payment.ts` and `app/checkout/actions.ts:96` both read `quote.lines`.

- [ ] **Step 4: Open a day in every existing SQL test fixture**

Each of `supabase/tests/create_order.test.sql`, `order_board.test.sql`, `order_removal.test.sql`, `card.test.sql`, `release_order.test.sql` calls `create_order()`. Add this line to each fixture block, immediately after the staff inserts and before the first `create_order`:

```sql
  -- create_order() now refuses a closed shop. Every fixture opens the day.
  insert into service_days (day) values ((now() at time zone shop_tz())::date)
  on conflict (day) do update set closed_at = null;
```

- [ ] **Step 5: Run the whole SQL suite**

Run:
```bash
supabase db reset
for f in supabase/tests/*.test.sql; do echo "== $f"; psql "$DATABASE_URL" -f "$f" || break; done
```
Expected: every file ends with its `all assertions passed` notice.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260901090000_service_day.sql supabase/tests
git commit -m "feat(day): orders take a daily ticket number and a closed shop refuses them"
```

---

## Task 3: `lib/service-day.ts` and the opening action

**Files:**
- Create: `lib/service-day.ts`
- Create: `lib/service-day.test.ts`
- Modify: `app/dashboard/actions.ts` (append `openServiceAction`)
- Modify: `lib/staff.ts` (append `currentDay`)

**Interfaces:**
- Consumes: `open_service`, `current_service_day` from A1/A2
- Produces: `type ServiceDay` · `type ParItem` · `parOverrides(items, counts)` · `dayLabel(day)` · `currentDay()` · `openServiceAction(counts: Record<string, number>)`

- [ ] **Step 1: Write the failing test**

Create `lib/service-day.test.ts`:

```ts
// node --test lib/service-day.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { dayLabel, parOverrides } from "./service-day.ts";
import type { ParItem } from "./service-day.ts";

const items: ParItem[] = [
  { id: "a", name: "Croissant", par_stock: 18 },
  { id: "b", name: "Cinnamon Bun", par_stock: 12 },
];

test("only counts that differ from par are sent", () => {
  assert.deepEqual(parOverrides(items, { a: 18, b: 9 }), { b: 9 });
});

test("an untouched form sends nothing", () => {
  assert.deepEqual(parOverrides(items, { a: 18, b: 12 }), {});
});

test("a missing or junk count falls back to par rather than to zero", () => {
  assert.deepEqual(parOverrides(items, { a: Number.NaN }), {});
});

test("zero is a real count, not a missing one", () => {
  assert.deepEqual(parOverrides(items, { a: 0 }), { a: 0 });
});

test("the day reads as the shop reads it", () => {
  assert.equal(dayLabel("2026-09-02"), "Wednesday 2 September");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test lib/service-day.test.ts`
Expected: FAIL — `Cannot find module './service-day.ts'`

- [ ] **Step 3: Write the module**

Create `lib/service-day.ts`:

```ts
/**
 * The trading day, as the interface talks about it.
 *
 * No date library: two formatters and a diff are twenty lines, and lib/manage.ts
 * already sets the precedent for doing shop-local dates with Intl.
 */

export type ServiceDay = {
  day: string;
  opened_at: string;
  opened_by: string | null;
  closed_at: string | null;
  next_number: number;
  float_cash: number;
  counted_cash: number | null;
};

/** A batch item on the opening screen. Unlimited items never appear here. */
export type ParItem = { id: string; name: string; par_stock: number };

/**
 * What the opening form actually needs to send. Anything left at par is left
 * out, so the payload names only what the person changed — which is also what
 * the audit row should record.
 */
export function parOverrides(
  items: ParItem[],
  counts: Record<string, number>,
): Record<string, number> {
  const overrides: Record<string, number> = {};
  for (const item of items) {
    const count = counts[item.id];
    // A blank or half-typed field means "as planned", never "none". Reading it
    // as zero would 86 the whole bake on one stray keystroke.
    if (!Number.isInteger(count) || count < 0) continue;
    if (count !== item.par_stock) overrides[item.id] = count;
  }
  return overrides;
}

/** `Wednesday 2 September` — how the bar would say it out loud. */
export function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/service-day.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Add `currentDay()` to `lib/staff.ts`**

Append, next to `currentShift`:

```ts
/**
 * The open service day, or null when the shop is shut. Cached per request: the
 * header pill and the board both ask on every render, exactly as currentShift
 * is already shared.
 */
export const currentDay = cache(async (): Promise<ServiceDay | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_days")
    .select("day, opened_at, opened_by, closed_at, next_number, float_cash, counted_cash")
    .is("closed_at", null)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ServiceDay | null) ?? null;
});
```

Import `ServiceDay` from `@/lib/service-day` at the top.

- [ ] **Step 6: Add the action**

Append to `app/dashboard/actions.ts`:

```ts
/**
 * Opens the day. No requireActor("shop.open") gate beyond holding a PIN cookie:
 * open_service() re-reads the role from the table like every other RPC here,
 * and the permission is granted to everyone on shift anyway.
 */
export async function openServiceAction(
  counts: Record<string, number>,
): Promise<Result> {
  try {
    const actor = await requireActor("shop.open");
    const supabase = await createClient();

    const { error } = await supabase.rpc("open_service", {
      p_actor: actor.staffId,
      p_stock: Object.keys(counts).length > 0 ? counts : undefined,
    });
    if (error) return fail(error);

    await slide(actor);
    revalidatePath("/dashboard", "layout");
    // The storefront was refusing orders a second ago. It must not go on doing
    // so for the thirty seconds app/page.tsx would otherwise cache.
    revalidatePath("/", "page");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
```

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm exec tsc --noEmit`
Expected: no errors

```bash
git add lib/service-day.ts lib/service-day.test.ts lib/staff.ts app/dashboard/actions.ts
git commit -m "feat(day): opening action and the day vocabulary"
```

---

## Task 4: `ServiceClosed` — the screen the morning starts on

**Files:**
- Create: `components/dashboard/ServiceClosed.tsx`
- Modify: `app/dashboard/board/page.tsx` (fetch the par list and the day)
- Modify: `components/dashboard/OrderBoard.tsx:44-70` (render `ServiceClosed` before `ShiftStart`)

**Interfaces:**
- Consumes: `openServiceAction`, `ParItem`, `dayLabel`, `parOverrides`
- Produces: `<ServiceClosed items unlocked />`

- [ ] **Step 1: Write the component**

Create `components/dashboard/ServiceClosed.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";

import { openServiceAction } from "@/app/dashboard/actions";
import { dayLabel, parOverrides, type ParItem } from "@/lib/service-day";
import { shopDayKey } from "@/lib/manage";

/**
 * The first screen of the day, in the same slot ShiftStart occupies and for the
 * same reason: one deliberate tap beats a banner nobody presses. It is not a
 * splash — until it is answered the storefront is refusing orders.
 */
export function ServiceClosed({
  items,
  unlocked,
}: {
  items: ParItem[];
  unlocked: boolean;
}) {
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.par_stock])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function open() {
    setError(null);
    start(async () => {
      const result = await openServiceAction(parOverrides(items, counts));
      if (!result.ok) setError(result.error ?? "That did not go through.");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end overflow-y-auto bg-kds-canvas px-5 pb-16 sm:px-10 lg:px-14">
      <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
        Service
        <span aria-hidden className="mx-3 text-kds-border">/</span>
        {dayLabel(shopDayKey())}
      </p>

      <h1 className="mt-5 max-w-[16ch] font-serif text-[clamp(56px,10vw,148px)] leading-[0.92] tracking-[-0.03em]">
        Nothing is <em className="text-accent-primary">open</em> yet.
      </h1>

      {items.length > 0 && (
        <ul className="mt-10 max-w-lg divide-y divide-kds-border border-y border-kds-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-6 py-4">
              <span className="min-w-0 truncate font-mono text-[11px] font-medium tracking-[0.14em] uppercase">
                {item.name}
                <span aria-hidden className="mx-3 text-kds-border">/</span>
                <span className="text-kds-text-secondary">Par {item.par_stock}</span>
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={999}
                value={Number.isInteger(counts[item.id]) ? counts[item.id] : ""}
                onChange={(event) =>
                  setCounts((current) => ({
                    ...current,
                    [item.id]: event.target.valueAsNumber,
                  }))
                }
                aria-label={`How many ${item.name} today`}
                className="h-10 w-20 shrink-0 border-b border-kds-border bg-transparent text-right font-mono text-[15px] tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 font-mono text-[11px] font-medium tracking-[0.14em] text-kds-text-secondary uppercase">
        Espresso bar
        <span aria-hidden className="mx-3 text-kds-border">/</span>
        Unlimited
      </p>

      <button
        type="button"
        onClick={open}
        disabled={!unlocked || pending}
        className="mt-10 flex h-10 w-fit items-center rounded-full bg-accent-primary px-6 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:bg-kds-surface disabled:text-kds-text-secondary"
      >
        {pending ? "Opening" : "Open service"}
      </button>

      {!unlocked && (
        <p
          role="status"
          className="mt-4 font-mono text-[11px] tracking-[0.14em] text-accent-primary uppercase"
        >
          Unlock with your PIN to open the day.
        </p>
      )}

      {error && (
        <p
          role="status"
          className="mt-4 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase"
        >
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Feed it from the board page**

In `app/dashboard/board/page.tsx`, add to the `Promise.all` and pass through:

```tsx
  const [{ data }, actor, { data: par }] = await Promise.all([
    supabase.rpc("staff_board"),
    currentActor(),
    // Only batch items. Espresso-bar drinks are unlimited and are stated once
    // on the opening screen rather than listed as sixteen disabled fields.
    supabase
      .from("menu_items")
      .select("id, name, par_stock")
      .eq("is_active", true)
      .not("par_stock", "is", null)
      .order("sort_order"),
  ]);

  const [shiftSince, day] = await Promise.all([currentShift(), currentDay()]);

  return (
    <OrderBoard
      initial={(data as BoardOrder[] | null) ?? []}
      unlocked={Boolean(actor)}
      shiftSince={shiftSince}
      dayOpen={Boolean(day)}
      par={(par as ParItem[] | null) ?? []}
    />
  );
```

- [ ] **Step 3: Render it first in `OrderBoard`**

Add `dayOpen: boolean` and `par: ParItem[]` to the props, then immediately before the `askToStart` overlay in the returned JSX:

```tsx
  // Order matters. A shift cannot start inside a day that has not opened, and
  // asking for a PIN-holder's shift over a closed shop is the wrong question.
  if (!dayOpen) return <ServiceClosed items={par} unlocked={unlocked} />;
```

- [ ] **Step 4: Verify in the browser**

Run: `pnpm dev`. In SQL, `update service_days set closed_at = now() where closed_at is null;` then load `http://localhost:3000/dashboard/board`.
Expected: the opening screen, with one row per batch item prefilled at par. Unlock with a PIN, change one count, press **Open service** — the board appears and `select daily_stock from menu_items` shows par everywhere except the edited item.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ServiceClosed.tsx app/dashboard/board/page.tsx components/dashboard/OrderBoard.tsx
git commit -m "feat(day): open the service from the board"
```

---

## Task 5: The day pill, `/dashboard/day`, and the ticket number everywhere

**Files:**
- Create: `components/dashboard/DayPill.tsx`
- Create: `app/dashboard/day/page.tsx`
- Modify: `app/dashboard/layout.tsx` (pass the day into `StaffBar`)
- Modify: `components/dashboard/StaffBar.tsx` (render the pill)
- Modify: `types/board.ts` (add `day_number`)
- Modify: `supabase/migrations/20260901090000_service_day.sql` (append: `staff_order` and `order_by_token` project `day_number`)
- Modify: `components/dashboard/OrderRow.tsx`, `components/dashboard/OrderDetail.tsx:113`, `app/order/[token]/page.tsx:59`, `components/account/OrderRow.tsx`

**Interfaces:**
- Consumes: `currentDay()` from A3
- Produces: `<DayPill day />` · `/dashboard/day` · `BoardOrder.day_number`

- [ ] **Step 1: Project `day_number` from both order RPCs**

Append to the migration — `create or replace` of `order_by_token` and `staff_order`, each with `'day_number', o.day_number,` inserted directly after the `'order_number'` line. Copy the rest of each function verbatim from `20260818142000_order_read_release.sql:5` and `20260822090200_order_board.sql:203`; changing anything else in them is out of scope for this task.

- [ ] **Step 2: Write the pill**

Create `components/dashboard/DayPill.tsx`:

```tsx
"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The only place mid-service that answers "did anyone actually open?". Text and
 * not an icon, because the state matters more than the affordance.
 */
export function DayPill({ openedAt }: { openedAt: string | null }) {
  const clock = openedAt
    ? new Date(openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Link
      href="/dashboard/day"
      className={cn(
        "flex h-9 shrink-0 items-center rounded-full border px-4 font-mono text-[10px] font-medium tracking-[0.18em] uppercase transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
        clock
          ? "border-kds-border text-kds-text-secondary hover:border-kds-text-secondary hover:text-kds-text-primary"
          : "border-badge-alert text-badge-alert",
      )}
    >
      <span className="mr-[-0.18em]">
        {clock ? (
          <>
            Day
            <span aria-hidden className="mx-2.5 text-kds-border">/</span>
            <span className="tabular-nums">{clock}</span>
          </>
        ) : (
          "Closed"
        )}
      </span>
    </Link>
  );
}
```

Render it in `StaffBar` immediately after the `ConnectionPill` wrapper, taking a new `dayOpenedAt: string | null` prop. `app/dashboard/layout.tsx` supplies it from `currentDay()`, added to the existing `Promise.all`.

- [ ] **Step 3: Write `/dashboard/day`**

Create `app/dashboard/day/page.tsx` — a server component. It redirects to `/dashboard/unlock` when there is no actor (mirroring `app/dashboard/numbers/page.tsx:39`), then renders:

- eyebrow `SERVICE / {dayLabel(day.day)}`, or `SERVICE / NOT OPEN` in `badge-alert`
- a sans line `Opened {clock} by {name}` resolved from `staff` via `opened_by`
- the count of today's orders as a serif heading
- what is left on the counter: `select name, daily_stock from menu_items where daily_stock > 0` as one `/`-separated mono line
- a `Count the drawer` link to `/dashboard/day/close`, rendered only when `staffCan(actor.role, "shop.close")`

The takings block lands here in Task 12; leave the file's structure ready for it with a `{/* Task 12: <DayReport /> */}` comment at the insertion point.

- [ ] **Step 4: Switch every customer-facing number to `day_number`**

Add `day_number: number | null;` to `BoardOrder` in `types/board.ts`, then replace `order.order_number` with `order.day_number ?? order.order_number` in:

- `app/order/[token]/page.tsx:59` — the giant serif `#042`
- `components/dashboard/OrderDetail.tsx:113` — the number beside the name
- `components/dashboard/OrderRow.tsx` — the row's ticket number
- `components/account/OrderRow.tsx` — the account history row

The `??` fallback covers rows placed before this migration in any environment where the backfill has not run. Add this comment above the first one:

```tsx
// The bar calls the day's ticket, not the all-time one. order_number stays as
// the permanent id behind the ledger; day_number is what a person says out loud.
```

- [ ] **Step 5: Verify**

Run: `pnpm dev`. Place two counter orders through the storefront.
Expected: they read `#001` and `#002` on `/order/[token]`, on the board, and on the order detail. `select order_number, day_number from orders order by placed_at desc limit 2;` shows the global number still incrementing independently.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/DayPill.tsx app/dashboard/day components/dashboard/StaffBar.tsx app/dashboard/layout.tsx types/board.ts supabase/migrations/20260901090000_service_day.sql components/dashboard/OrderRow.tsx components/dashboard/OrderDetail.tsx app/order components/account/OrderRow.tsx
git commit -m "feat(day): the day pill, the day page and daily ticket numbers"
```

---

## Task 6: The storefront knows the shop is shut

**Files:**
- Modify: `app/page.tsx` (read the open day alongside the menu)
- Modify: `components/storefront/Storefront.tsx` (thread `serviceOpen`)
- Modify: `components/storefront/CartDrawer.tsx` (the checkout CTA)
- Modify: `components/checkout/CheckoutForm.tsx:120-135` (the closed state)
- Modify: `components/storefront/DayLedger.tsx` (the ledger says it too)

**Interfaces:**
- Consumes: `current_service_day()`
- Produces: `serviceOpen: boolean` threaded from the server component to the cart and the checkout

- [ ] **Step 1: Read it on the page**

In `app/page.tsx`, add to the existing parallel fetch:

```tsx
  // Anonymous read: current_service_day() is granted to anon precisely so the
  // storefront can say "closed" instead of taking an order nobody will make.
  const { data: openDay } = await supabase.rpc("current_service_day");
```

Pass `serviceOpen={Boolean(openDay)}` into `<Storefront />`.

- [ ] **Step 2: Say it in the cart**

In `CartDrawer`, when `!serviceOpen` the checkout CTA is disabled and reads `Closed — opens 07:30`, with the existing disabled treatment (`bg-surface-muted text-text-tertiary`). Items can still be added; a customer building tomorrow's order is not a bug, and clearing their cart at closing time would be.

- [ ] **Step 3: Say it on the checkout page**

In `CheckoutForm`, add a branch beside the existing `cart.lines.length === 0` early return:

```tsx
  if (!serviceOpen) {
    return (
      <p className={NOTE}>
        The bakehouse is closed. Orders reopen at 07:30 — your cart is still here.
      </p>
    );
  }
```

- [ ] **Step 4: Say it in the ledger**

In `DayLedger`, when `!serviceOpen` the first segment of the marquee becomes `CLOSED` in `badge-alert`, before the opening hours. One word, in the running ledger that is already there — no new element.

- [ ] **Step 5: Verify**

Run: `pnpm dev`, close the day in SQL, reload `/`.
Expected: the ledger leads with `CLOSED`, the cart CTA is disabled, `/checkout` shows the closed note, and forcing a `placeOrder` through the network tab returns `The bakehouse is closed.`

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/storefront components/checkout/CheckoutForm.tsx
git commit -m "feat(day): the storefront says when the bakehouse is closed"
```

---

# Phase B — VAT

## Task 7: Rates on categories, tax on orders

**Files:**
- Create: `supabase/migrations/20260901091000_vat.sql`
- Create: `supabase/tests/vat.test.sql`

**Interfaces:**
- Consumes: `order_lines()`, `create_order()` as left by Phase A
- Produces: `menu_categories.vat_rate` · `order_items.vat_rate` · `orders.tax_total` · `order_lines()` returning `vat_rate` per line

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/vat.test.sql`:

```sql
begin;

do $$
declare
  v_cat   uuid;
  v_item  uuid;
  v_order orders;
  v_lines jsonb;
begin
  insert into service_days (day) values ((now() at time zone shop_tz())::date)
  on conflict (day) do update set closed_at = null;

  insert into menu_categories (slug, name, vat_rate)
  values ('test-vat', 'Test VAT', 0.11) returning id into v_cat;

  insert into menu_items (category_id, slug, name, base_price)
  values (v_cat, 'test-vat-item', 'Test VAT Item', 11.10) returning id into v_item;

  v_lines := order_lines(
    jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_item, 'quantity', 2, 'modifiers', '[]'::jsonb)),
    false);

  assert (v_lines -> 0 ->> 'vat_rate')::numeric = 0.11,
         'the line carries its category rate';

  v_order := create_order(
    jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_item, 'quantity', 2, 'modifiers', '[]'::jsonb)),
    'VAT', '', 'counter');

  -- 22.20 gross at 11% → 22.20 - 22.20/1.11 = 2.20
  assert v_order.total = 22.20,     'the price the customer pays is unchanged';
  assert v_order.tax_total = 2.20,  'VAT is extracted, never added';
  assert (select vat_rate from order_items where order_id = v_order.id) = 0.11,
         'the rate is snapshotted on the line';

  -- a rate change must not rewrite what was already sold
  update menu_categories set vat_rate = 0.21 where id = v_cat;
  assert (select vat_rate from order_items where order_id = v_order.id) = 0.11,
         'history keeps the rate it was sold at';

  raise notice 'vat: all assertions passed';
end $$;

rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `psql "$DATABASE_URL" -f supabase/tests/vat.test.sql`
Expected: FAIL with `column "vat_rate" of relation "menu_categories" does not exist`

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260901091000_vat.sql`:

```sql
-- VAT, extracted rather than added.
--
-- subtotal and total have been the same number since the schema was written,
-- because nothing anywhere breaks tax out. A shop's books cannot be filed from
-- that. Romania since 1 Aug 2025: 21% standard, 11% reduced covering food,
-- non-alcoholic drinks and restaurant service. Everything KROMA sells today is
-- 11%; the column exists so alcohol can be 21% without another migration.
--
-- The rate hangs off the CATEGORY, not off eat-in vs takeaway: both are 11%
-- here, so a fulfilment column would change no number and is not added.
--
-- Displayed prices stay gross, as EU consumer law requires and as base_price
-- already is:  vat = gross - gross / (1 + rate).

alter table menu_categories
  add column vat_rate numeric(4,3) not null default 0.110
    check (vat_rate >= 0 and vat_rate < 1);

-- Snapshotted for the same reason item_name and base_price are: a rate change
-- in 2027 must not rewrite 2026's books.
alter table order_items
  add column vat_rate numeric(4,3) not null default 0.110;

alter table orders
  add column tax_total numeric(8,2) not null default 0 check (tax_total >= 0);

-- One helper, so the rounding rule lives in exactly one place.
create function vat_of(p_gross numeric, p_rate numeric)
returns numeric
language sql
immutable
as $$
  select round(p_gross - p_gross / (1 + p_rate), 2);
$$;

-- ------------------------------------------------------------------ backfill
-- A shop's books do not get to have a gap.
update order_items i
   set vat_rate = coalesce(c.vat_rate, 0.110)
  from menu_items m
  join menu_categories c on c.id = m.category_id
 where m.id = i.menu_item_id;

update orders o
   set tax_total = coalesce(agg.tax, 0)
  from (select order_id, sum(vat_of(line_total, vat_rate)) as tax
          from order_items group by order_id) agg
 where agg.order_id = o.id;
```

Then `create or replace function order_lines(...)` — copy the body verbatim from `20260819122500_card_redeem_one_unit.sql:15`, and make exactly two changes:

```sql
    -- next to the existing earns_punch lookup, on the join that already exists
    select mc.earns_punch, mc.vat_rate into v_earns, v_vat
      from menu_categories mc
     where mc.id = v_item.category_id;
    v_earns := coalesce(v_earns, false);
    v_vat   := coalesce(v_vat, 0.110);
```

```sql
    -- and one more key on the line object it returns
      'vat_rate',           v_vat,
```

declaring `v_vat numeric(4,3);` alongside `v_earns`.

Then `create or replace function create_order(...)` — copy the body from Task 2 and make two changes: sum the tax, and write both new columns:

```sql
  v_tax := coalesce((select sum(vat_of((l ->> 'line_total')::numeric,
                                       (l ->> 'vat_rate')::numeric))
                       from jsonb_array_elements(v_lines) as t(l)), 0);
```

`tax_total` joins the `insert into orders` column list with value `v_tax`, and the `insert into order_items` gains `vat_rate` with `(l ->> 'vat_rate')::numeric`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase db reset && psql "$DATABASE_URL" -f supabase/tests/vat.test.sql`
Expected: `NOTICE: vat: all assertions passed`

- [ ] **Step 5: Run the whole SQL suite for regressions**

Run: `for f in supabase/tests/*.test.sql; do echo "== $f"; psql "$DATABASE_URL" -f "$f" || break; done`
Expected: every file passes. `create_order.test.sql` asserts on `subtotal` and `total`, neither of which this task changes.

- [ ] **Step 6: Regenerate types and commit**

```bash
supabase gen types typescript --local > types/supabase.ts
git add supabase/migrations/20260901091000_vat.sql supabase/tests/vat.test.sql types/supabase.ts
git commit -m "feat(vat): per-category rates, extracted inclusive VAT, snapshotted per line"
```

---

## Task 8: `lib/vat.ts` and the one VAT line

**Files:**
- Create: `lib/vat.ts`
- Create: `lib/vat.test.ts`
- Modify: `components/checkout/OrderSummary.tsx:66-77` (the total block)
- Modify: `app/order/[token]/page.tsx:96-106` (the total block)
- Modify: `components/checkout/OrderStatus.tsx:24-34` (`OrderDoc` gains `tax_total`)

**Interfaces:**
- Produces: `vatOf(gross, rate)` · `vatLabel(rate)` · `groupByRate(lines)`

- [ ] **Step 1: Write the failing test**

Create `lib/vat.test.ts`:

```ts
// node --test lib/vat.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { groupByRate, vatLabel, vatOf } from "./vat.ts";

test("VAT is extracted from a gross price, never added to it", () => {
  assert.equal(vatOf(22.2, 0.11), 2.2);
  assert.equal(vatOf(4.2, 0.11), 0.42);
});

test("rounding lands on the cent, half up", () => {
  assert.equal(vatOf(0.05, 0.11), 0.0);
  assert.equal(vatOf(1.0, 0.21), 0.17);
});

test("the label states the rate as a whole percent", () => {
  assert.equal(vatLabel(0.11), "Incl. VAT 11%");
  assert.equal(vatLabel(0.21), "Incl. VAT 21%");
});

test("mixed rates group and total separately", () => {
  const grouped = groupByRate([
    { line_total: 10, vat_rate: 0.11 },
    { line_total: 5, vat_rate: 0.11 },
    { line_total: 10, vat_rate: 0.21 },
  ]);
  assert.deepEqual(grouped, [
    { rate: 0.11, gross: 15, vat: 1.49 },
    { rate: 0.21, gross: 10, vat: 1.74 },
  ]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test lib/vat.test.ts`
Expected: FAIL — `Cannot find module './vat.ts'`

- [ ] **Step 3: Write the module**

Create `lib/vat.ts`:

```ts
/**
 * The TypeScript half of vat_of(). Prices are gross everywhere — on the menu,
 * in the cart, on the receipt — so VAT is always a fact ABOUT the total, never
 * an addition to it. Keep this in step with the SQL function; both round to the
 * cent, and a UI that disagrees with the books by a cent is worse than one that
 * shows nothing.
 */

export function vatOf(gross: number, rate: number): number {
  return Math.round((gross - gross / (1 + rate)) * 100) / 100;
}

/** `Incl. VAT 11%`. Whole percents only — no rate here has a fraction. */
export function vatLabel(rate: number): string {
  return `Incl. VAT ${Math.round(rate * 100)}%`;
}

export type RatedLine = { line_total: number; vat_rate: number };

/** One row per rate, ascending. A single-rate order yields one row. */
export function groupByRate(lines: RatedLine[]): { rate: number; gross: number; vat: number }[] {
  const totals = new Map<number, number>();
  for (const line of lines) {
    totals.set(line.vat_rate, (totals.get(line.vat_rate) ?? 0) + line.line_total);
  }
  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, gross]) => ({ rate, gross, vat: vatOf(gross, rate) }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/vat.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Draw the line**

Under every existing total block, one mono metadata line — never a second total:

```tsx
        <p className="mt-2 text-right font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
          {vatLabel(rate)}
          <span aria-hidden className="mx-3 text-hairline">/</span>
          <span className="tabular-nums">€{vat.toFixed(2)}</span>
        </p>
```

In `OrderSummary` the cart has no rate yet — the cart is client-side and never saw a category. Add `vat_rate` to `CartLine` in `lib/cart.ts`, populated in `MenuRow`'s add handler from a new `vat_rate` column on the menu query in `app/page.tsx`, and derive the line with `groupByRate`. On `/order/[token]` and the account rows the value comes straight from `tax_total`.

- [ ] **Step 6: Verify and commit**

Run: `pnpm dev`, put a €4.20 cortado in the cart, open `/checkout`.
Expected: `TOTAL €4.20` and beneath it `INCL. VAT 11% / €0.42`, in `text-tertiary` at metadata weight.

```bash
git add lib/vat.ts lib/vat.test.ts components/checkout app/order lib/cart.ts app/page.tsx components/storefront/MenuRow.tsx
git commit -m "feat(vat): one inclusive-VAT line wherever money is totalled"
```

---

# Phase C — Tender and the Z-report

## Task 9: `settled_as` and the tender on `advance_order`

**Files:**
- Create: `supabase/migrations/20260901092000_tender_and_close.sql`
- Create: `supabase/tests/close_service.test.sql`
- Modify: `supabase/tests/order_board.test.sql` (existing `pending → paid` calls need a tender)

**Interfaces:**
- Consumes: `advance_order` as left by `20260822091100_order_removal.sql:77`
- Produces: `orders.settled_as` · `advance_order(p_order_id, p_to, p_actor, p_station, p_tender)`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/close_service.test.sql` with a fixture that opens a day, inserts an owner, places a counter order, and then:

```sql
  -- tender ---------------------------------------------------------------
  begin;
    perform advance_order(v_order.id, 'paid', v_owner);
    assert false, 'a counter order cannot be paid without a tender';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'Cash or card?', 'and it asks which';
  end;

  perform advance_order(v_order.id, 'paid', v_owner, null, 'cash');
  assert (select settled_as from orders where id = v_order.id) = 'cash',
         'the tender is recorded where the money arrived';

  -- stepping back hands the money back --------------------------------------
  perform advance_order(v_order.id, 'pending', v_owner);
  assert (select settled_as from orders where id = v_order.id) is null,
         'stepping back clears the tender';

  -- an online order never asks ----------------------------------------------
  assert (select settled_as from orders where id = v_online.id) = 'online',
         'a card order settles itself';
```

- [ ] **Step 2: Run it to verify it fails**

Run: `psql "$DATABASE_URL" -f supabase/tests/close_service.test.sql`
Expected: FAIL with `column "settled_as" does not exist`

- [ ] **Step 3: Write the column and the new `advance_order`**

In the migration:

```sql
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
```

Then `create or replace function advance_order(p_order_id uuid, p_to order_status, p_actor uuid, p_station uuid default null, p_tender text default null)` — the body copied verbatim from `20260822091100_order_removal.sql:77` with one block inserted after the permission check and one clause added to the `update`:

```sql
  -- The one moment the shop learns how it was paid: a barista taking money at
  -- the counter. Asking later is asking someone to remember.
  if v_order.payment_method = 'counter' and v_order.status = 'pending' and p_to = 'paid' then
    if p_tender not in ('cash', 'card') then
      raise exception 'Cash or card?' using errcode = 'P0001';
    end if;
  end if;
```

```sql
         settled_as   = case
                          when p_to = 'paid' and v_order.payment_method = 'counter'
                            then p_tender
                          when p_to = 'pending' then null
                          else settled_as end,
```

`p_tender` also joins the audit `detail` object.

Note the `default null` on `p_station` must stay — `app/dashboard/actions.ts:170` passes `p_station: station?.id`, which supabase-js omits when undefined, and Postgres refuses to drop a parameter default through `create or replace`.

- [ ] **Step 4: Update the existing board test**

In `supabase/tests/order_board.test.sql`, every `advance_order(..., 'paid', ...)` on a counter order gains `, null, 'cash'`.

- [ ] **Step 5: Run both tests**

Run: `supabase db reset && psql "$DATABASE_URL" -f supabase/tests/order_board.test.sql && psql "$DATABASE_URL" -f supabase/tests/close_service.test.sql`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260901092000_tender_and_close.sql supabase/tests
git commit -m "feat(till): record whether a counter order was cash or card"
```

---

## Task 10: Cash and Card, on the two screens that take money

**Files:**
- Modify: `app/dashboard/actions.ts:158-196` (`advanceOrderAction` takes a tender)
- Modify: `lib/order-transitions.ts:66-72` (`ADVANCE_LABELS`, plus a tender type)
- Modify: `components/dashboard/OrderDetail.tsx:196-215` (the forward button)
- Modify: `components/dashboard/OrderRow.tsx` (the row's forward button)

**Interfaces:**
- Consumes: `advance_order(..., p_tender)` from C1
- Produces: `advanceOrderAction(orderId, to, tender?)` · `TENDERS: readonly ["cash", "card"]`

- [ ] **Step 1: Widen the action**

```ts
export async function advanceOrderAction(
  orderId: string,
  to: OrderStatus,
  // Required by advance_order() for a counter order's pending → paid, ignored
  // everywhere else. The RPC is the enforcement; this only carries it.
  tender?: "cash" | "card",
): Promise<Result> {
```

and pass `p_tender: tender` in the `rpc` call. Everything else in the function is unchanged.

- [ ] **Step 2: Split the button**

In `lib/order-transitions.ts`, replace the `pending` entry of `ADVANCE_LABELS` and add:

```ts
/** The two ways money arrives at the counter. Online settles itself. */
export const TENDERS = ["cash", "card"] as const;
export type Tender = (typeof TENDERS)[number];

export const TENDER_LABELS: Record<Tender, string> = { cash: "Cash", card: "Card" };
```

`ADVANCE_LABELS.pending` stays for online orders (which never sit in `pending`) but the UI no longer reads it for counter orders. In `OrderDetail`, replace the single forward button with:

```tsx
        {order.status === "pending" && order.payment_method === "counter" ? (
          // Two taps become one, and the drawer becomes countable. The same
          // press that says "paid" says how.
          TENDERS.map((tender) => (
            <motion.button
              key={tender}
              type="button"
              onClick={() => move("paid", tender)}
              disabled={pending || !role}
              whileTap={{ scale: 0.98 }}
              transition={pressSpring}
              className="h-10 rounded-full bg-accent-primary px-5 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:bg-kds-surface disabled:text-kds-text-secondary"
            >
              {TENDER_LABELS[tender]}
            </motion.button>
          ))
        ) : next ? (
          /* the existing single forward button, unchanged */
        ) : null}
```

`move` gains a second parameter and forwards it. Do the same in `OrderRow`, at `h-9` rather than `h-10`.

- [ ] **Step 3: Say which, once it is known**

In `OrderDetail`'s meta line, `order.payment_method === "online" ? "Paid online" : "Counter"` becomes:

```tsx
        {order.settled_as
          ? { cash: "Cash", card: "Card at the bar", online: "Paid online" }[order.settled_as]
          : "Not paid yet"}
```

Add `settled_as: "cash" | "card" | "online" | null` to `BoardOrder` and project it from `staff_order()` — a `create or replace` in the C1 migration, copying the function verbatim and adding one key.

- [ ] **Step 4: Verify**

Run: `pnpm dev`. Place a counter order, open it on the board.
Expected: two pills, `Cash` and `Card`. Press `Cash` — the order moves to `paid`, the meta line reads `Cash`, and `select settled_as from orders` confirms it. Press `Step back` within 90 seconds — `settled_as` is null again.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/actions.ts lib/order-transitions.ts components/dashboard types/board.ts supabase/migrations/20260901092000_tender_and_close.sql
git commit -m "feat(till): Cash and Card replace the single paid-at-counter button"
```

---

## Task 11: `service_report()` and `close_service()`

**Files:**
- Modify: `supabase/migrations/20260901092000_tender_and_close.sql` (append)
- Modify: `supabase/tests/close_service.test.sql` (append)
- Create: `types/day.ts`

**Interfaces:**
- Consumes: `settled_as`, `tax_total`, `order_was_paid()` from `20260823100000_manage_numbers.sql:49`
- Produces: `service_report(p_actor uuid, p_day date) returns jsonb` · `close_service(p_actor uuid, p_counted numeric, p_detail jsonb) returns jsonb` · `type DayReport`

- [ ] **Step 1: Write the failing assertions**

Append to `supabase/tests/close_service.test.sql`:

```sql
  -- the report ---------------------------------------------------------------
  v_report := service_report(v_owner, current_service_day());
  assert (v_report ->> 'cash')::numeric = 22.20,   'cash is what came in as cash';
  assert (v_report ->> 'orders')::int = 2,         'kept orders are counted';
  assert (v_report ->> 'expected_cash')::numeric
       = (v_report ->> 'float')::numeric + 22.20,  'expected is float plus cash';

  -- closing over live orders is refused --------------------------------------
  begin;
    perform close_service(v_owner, 122.20, '{}'::jsonb);
    assert false, 'a live order blocks the close';
  exception when sqlstate 'P0001' then
    assert sqlerrm like 'Still on the pass%', 'and names what is open';
  end;

  perform advance_order(v_live.id, 'cancelled', v_owner);
  v_report := close_service(v_owner, 122.20, '{"50":2}'::jsonb);

  assert (select closed_at from service_days where day = current_date) is not null,
         'the day is shut';
  assert (v_report ->> 'variance')::numeric = 0,   'a correct count is square';
  assert (select report from service_days where day = current_date) is not null,
         'and the report is frozen on the row';

  -- a barista may not ---------------------------------------------------------
  begin;
    perform close_service(v_barista, 0, '{}'::jsonb);
    assert false, 'a barista does not count the drawer';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'Not yours to do.', 'and is told so';
  end;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `psql "$DATABASE_URL" -f supabase/tests/close_service.test.sql`
Expected: FAIL — `function service_report(uuid, date) does not exist`

- [ ] **Step 3: Write both functions**

```sql
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
```

> `discount_total` is referenced here and arrives in Phase F. Either land Phase F first or add `add column discount_total numeric(8,2) not null default 0` to this migration and let F add only `discount_reason` and the RPC. Take the second option — the column is one line and this function is cleaner for having it.

- [ ] **Step 4: Write `types/day.ts`**

```ts
/** Exactly what service_report() returns. Keep the two in step. */
export type DayReport = {
  day: string;
  opened_at: string;
  closed_at: string | null;
  float: number;
  orders: number;
  taken: number;
  net: number;
  vat: number;
  cash: number;
  card: number;
  online: number;
  discounted: number;
  voided: number;
  refunded: number;
  binned: number;
  cash_refunded: number;
  expected_cash: number;
  left: { name: string; left: number }[];
  live: { id: string; number: number }[];
  /** Present only on a frozen report. */
  counted?: number;
  variance?: number;
};
```

- [ ] **Step 5: Run the test and commit**

Run: `supabase db reset && psql "$DATABASE_URL" -f supabase/tests/close_service.test.sql`
Expected: `NOTICE: close_service: all assertions passed`

```bash
supabase gen types typescript --local > types/supabase.ts
git add supabase/migrations/20260901092000_tender_and_close.sql supabase/tests/close_service.test.sql types
git commit -m "feat(till): the day's report, and a close that refuses over live orders"
```

---

## Task 12: `DayReport` on `/dashboard/day`

**Files:**
- Create: `components/dashboard/day/DayReport.tsx`
- Modify: `app/dashboard/day/page.tsx` (call `service_report`, render it)

**Interfaces:**
- Consumes: `service_report`, `DayReport`
- Produces: `<DayReport report />`

- [ ] **Step 1: Write the component**

A presentational server-safe component — no state, no `"use client"`. Three hairline-divided groups of label/value rows, exactly the `Ledger` vocabulary:

```tsx
import type { DayReport as Report } from "@/types/day";
import { vatLabel } from "@/lib/vat";

const money = (n: number) => `€${n.toFixed(2)}`;

/** One group of rows between two hairlines. The page is three of these. */
function Group({ rows }: { rows: [string, string, string?][] }) {
  return (
    <ul className="divide-y divide-kds-border border-y border-kds-border">
      {rows.map(([label, value, tone]) => (
        <li key={label} className="flex items-baseline justify-between gap-6 py-4">
          <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
            {label}
          </span>
          <span className={cn("font-mono text-[15px] tabular-nums", tone ?? "text-kds-text-primary")}>
            {value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DayReport({ report }: { report: Report }) {
  return (
    <div className="mt-10 max-w-lg space-y-10">
      <Group
        rows={[
          ["Taken", money(report.taken)],
          ["Cash", money(report.cash)],
          ["Card at the bar", money(report.card)],
          ["Online", money(report.online)],
        ]}
      />
      <Group
        rows={[
          [vatLabel(0.11), money(report.vat)],
          ["Net", money(report.net)],
        ]}
      />
      <Group
        rows={[
          ["Discounted", `−${money(report.discounted)}`, "text-accent-primary"],
          ["Voided", money(report.voided), "text-badge-alert"],
          ["Refunded", money(report.refunded), "text-badge-alert"],
          ["Binned", money(report.binned), "text-badge-alert"],
        ]}
      />
      <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-kds-text-secondary uppercase">
        Left on the counter
        <span aria-hidden className="mx-3 text-kds-border">/</span>
        {report.left.length === 0
          ? "Nothing"
          : report.left.map((row) => `${row.left} ${row.name}`).join(" / ")}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the page**

`/dashboard/day` calls `supabase.rpc("service_report", { p_actor, p_day })` only when `staffCan(actor.role, "shop.close")` — a barista sees the day's state and the leftover stock, never the takings, matching how `/dashboard/numbers` is already gated. Apply the same "a failed read stops the page" rule `app/dashboard/numbers/page.tsx:80-86` documents: a read error must not render as `€0.00`.

- [ ] **Step 3: Verify and commit**

Run: `pnpm dev`, take a cash order and a card order, visit `/dashboard/day` as a manager.
Expected: `TAKEN` equals the two totals, split correctly across `CASH` and `CARD AT THE BAR`, with the VAT line matching `select sum(tax_total)`.

```bash
git add components/dashboard/day app/dashboard/day
git commit -m "feat(till): the day's takings on the day page"
```

---

## Task 13: Counting the drawer

**Files:**
- Create: `lib/cash.ts`, `lib/cash.test.ts`
- Create: `components/dashboard/day/CashCount.tsx`
- Create: `app/dashboard/day/close/page.tsx`
- Modify: `app/dashboard/actions.ts` (append `closeServiceAction`)

**Interfaces:**
- Consumes: `close_service`, `DayReport`
- Produces: `DENOMINATIONS` · `countTotal(counts)` · `varianceWord(diff)` · `closeServiceAction(counted, detail)`

- [ ] **Step 1: Write the failing test**

Create `lib/cash.test.ts`:

```ts
// node --test lib/cash.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { countTotal, DENOMINATIONS, varianceWord } from "./cash.ts";

test("the ladder runs largest first and reaches ten cents", () => {
  assert.equal(DENOMINATIONS[0], 50);
  assert.equal(DENOMINATIONS.at(-1), 0.1);
});

test("a count totals in cents, so floats never drift", () => {
  assert.equal(countTotal({ "0.1": 3, "0.2": 1 }), 0.5);
  assert.equal(countTotal({ "50": 2, "20": 6, "0.5": 12 }), 226);
});

test("an empty or half-typed drawer totals zero, not NaN", () => {
  assert.equal(countTotal({}), 0);
  assert.equal(countTotal({ "50": Number.NaN }), 0);
});

test("variance is stated as the bar would say it", () => {
  assert.deepEqual(varianceWord(0), { word: "Square", tone: "live" });
  assert.deepEqual(varianceWord(3.7), { word: "Over by", tone: "alert" });
  assert.deepEqual(varianceWord(-1.2), { word: "Short by", tone: "alert" });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test lib/cash.test.ts`
Expected: FAIL — `Cannot find module './cash.ts'`

- [ ] **Step 3: Write the module**

```ts
/**
 * Counting the drawer.
 *
 * Everything totals in integer cents and divides once at the end: a drawer that
 * is out by €0.01 because of binary floating point is a drawer someone spends
 * twenty minutes recounting.
 */

/** Euro notes and coins, largest first. €500/€200/€100 are not kept in a café till. */
export const DENOMINATIONS = [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1] as const;

export function countTotal(counts: Record<string, number>): number {
  let cents = 0;
  for (const denomination of DENOMINATIONS) {
    const n = counts[String(denomination)];
    if (!Number.isInteger(n) || n < 0) continue;
    cents += Math.round(denomination * 100) * n;
  }
  return cents / 100;
}

/** Operational words, not "variance". Square is the reward for a careful count. */
export function varianceWord(diff: number): { word: string; tone: "live" | "alert" } {
  if (Math.abs(diff) < 0.005) return { word: "Square", tone: "live" };
  return { word: diff > 0 ? "Over by" : "Short by", tone: "alert" };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/cash.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Write the action**

```ts
/**
 * Shuts the day. close_service() owns every rule — the permission, the refusal
 * over live orders, and freezing the report — so this only carries the count.
 */
export async function closeServiceAction(
  counted: number,
  detail: Record<string, number>,
): Promise<Result> {
  try {
    const actor = await requireActor("shop.close");
    const supabase = await createClient();

    const { error } = await supabase.rpc("close_service", {
      p_actor: actor.staffId,
      p_counted: counted,
      p_detail: detail,
    });
    if (error) return fail(error);

    await slide(actor);
    revalidatePath("/dashboard", "layout");
    // The storefront must stop taking orders the moment the till is counted.
    revalidatePath("/", "page");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
```

- [ ] **Step 6: Write `CashCount`**

A client component holding `counts` state, split `md:grid-cols-2` with `md:border-l border-kds-border md:pl-14` on the right column — the CLAUDE.md §5 split-by-border rule.

Left: one row per `DENOMINATIONS` entry — mono label, a `type="number"` input on a hairline underline, and the row subtotal wrapped in `AnimatePresence mode="popLayout"` keyed on its value with `numberTransition`, per CLAUDE.md §9. Then the counted total as an oversized serif figure.

Right: the reconciliation rows (`Float`, `Cash taken`, `Cash refunded`, `Expected`, `Counted`), then the variance line rendered through `varianceWord` — `text-badge-live` for `Square`, `text-badge-alert` otherwise. Then the CTA:

```tsx
        {report.live.length > 0 ? (
          <p role="status" className="mt-8 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase">
            {report.live.length} still on the pass
            <span aria-hidden className="mx-3 text-kds-border">/</span>
            {report.live.map((order, i) => (
              <span key={order.id}>
                {i > 0 && <span aria-hidden className="mx-3 text-kds-border">/</span>}
                <Link href={`/dashboard/order/${order.id}`} className="underline underline-offset-4">
                  #{String(order.number).padStart(3, "0")}
                </Link>
              </span>
            ))}
          </p>
        ) : (
          /* the Close the day button */
        )}
```

Naming the open tickets and linking each one is the whole reason this is not a disabled button: it tells you what to go and do.

- [ ] **Step 7: Verify end to end**

Run: `pnpm dev`. Take one €4.20 cash order and one card order, leave a third order on the pass, then open `/dashboard/day/close`.
Expected: the CTA is replaced by `1 still on the pass / #003` linking to that order. Collect it, return, count `1 × €5` — `EXPECTED €4.20`, `COUNTED €5.00`, `OVER BY €0.80` in `badge-alert`. Correct the count to €4.20 — `SQUARE` in `badge-live`. Press **Close the day**; the board falls back to `ServiceClosed` and `/checkout` refuses.

- [ ] **Step 8: Commit**

```bash
git add lib/cash.ts lib/cash.test.ts components/dashboard/day app/dashboard/day app/dashboard/actions.ts
git commit -m "feat(till): count the drawer and close the day"
```

---

# Phase D — Menu management

## Task 14: The write RPCs

**Files:**
- Create: `supabase/migrations/20260901093000_menu_admin.sql`
- Create: `supabase/tests/menu_admin.test.sql`

**Interfaces:**
- Produces: `valid_modifiers(jsonb) returns boolean` · `menu_upsert(p_actor uuid, p_item jsonb) returns menu_items` · `menu_reorder(p_actor uuid, p_ids uuid[]) returns integer` · `menu_category_upsert(p_actor uuid, p_category jsonb) returns menu_categories`

- [ ] **Step 1: Write the failing test**

`supabase/tests/menu_admin.test.sql` asserts, with an owner, a manager and a barista in the fixture:

```sql
  -- a barista may not edit the menu
  begin;
    perform menu_upsert(v_barista, jsonb_build_object('name','X','base_price',1,
      'category_id', v_cat, 'modifiers', '[]'::jsonb));
    assert false, 'a barista may not edit the menu';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'Not yours to do.', 'and is told so';
  end;

  -- a manager may, and the slug comes from the name
  v_item := menu_upsert(v_manager, jsonb_build_object(
    'name', 'Test Cortado', 'base_price', 4.20, 'category_id', v_cat,
    'par_stock', null, 'modifiers', '[]'::jsonb));
  assert v_item.slug = 'test-cortado', 'the slug is derived from the name';

  -- a price change is audited as a diff, not as a row dump
  v_item := menu_upsert(v_manager, jsonb_build_object(
    'id', v_item.id, 'name', 'Test Cortado', 'base_price', 4.50,
    'category_id', v_cat, 'modifiers', '[]'::jsonb));
  assert (select detail -> 'base_price' ->> 'from' from staff_events
           where action = 'menu.edit' order by id desc limit 1) = '4.20',
         'the audit row carries the old price';

  -- a malformed modifier group is refused at the door
  begin;
    perform menu_upsert(v_manager, jsonb_build_object(
      'name', 'Bad', 'base_price', 1, 'category_id', v_cat,
      'modifiers', '[{"name":"Milk","options":[{"name":"Oat"}]}]'::jsonb));
    assert false, 'an option without a priceOffset is not a modifier group';
  exception when sqlstate 'P0001' then
    assert sqlerrm like '%modifier%', 'and says which part is wrong';
  end;

  -- reorder
  perform menu_reorder(v_manager, array[v_b, v_a]);
  assert (select sort_order from menu_items where id = v_b) = 0, 'first is first';
```

- [ ] **Step 2: Run it to verify it fails**

Run: `psql "$DATABASE_URL" -f supabase/tests/menu_admin.test.sql`
Expected: FAIL — `function menu_upsert(uuid, jsonb) does not exist`

- [ ] **Step 3: Write the migration**

```sql
-- Editing the menu without a deploy.
--
-- menu.edit has existed in staff_can() since the dashboard shipped with nothing
-- behind it: changing a price has meant writing a migration. These three
-- functions are that surface, and they are the only writers — menu_items has no
-- insert or update policy and is not getting one.

-- The exact shape order_lines() parses. A malformed group does not surface as a
-- bad edit; it surfaces three days later as every checkout raising "that
-- selection is not on the menu". Validated here rather than in a CHECK because
-- a constraint would have to be immutable and would fail retroactively on rows
-- the app has already written.
create function valid_modifiers(p_modifiers jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p_modifiers) = 'array'
     and not exists (
       select 1 from jsonb_array_elements(p_modifiers) as g(v)
        where coalesce(btrim(g.v ->> 'name'), '') = ''
           or jsonb_typeof(g.v -> 'options') <> 'array'
           or jsonb_array_length(g.v -> 'options') = 0
           or exists (
                select 1 from jsonb_array_elements(g.v -> 'options') as o(v)
                 where coalesce(btrim(o.v ->> 'name'), '') = ''
                    or jsonb_typeof(o.v -> 'priceOffset') <> 'number')
           or (select count(distinct o.v ->> 'name')
                 from jsonb_array_elements(g.v -> 'options') as o(v))
              <> jsonb_array_length(g.v -> 'options'))
     and (select count(distinct g.v ->> 'name')
            from jsonb_array_elements(p_modifiers) as g(v))
         = jsonb_array_length(p_modifiers);
$$;

-- translate() rather than unaccent(): the extension is not installed and this
-- menu is Romanian and English. One expression, and it cannot fail at deploy.
create function menu_slug(p_name text)
returns text
language sql
immutable
as $$
  select btrim(
    regexp_replace(
      translate(lower(p_name), 'ăâîșşțţ', 'aaissttt'),
      '[^a-z0-9]+', '-', 'g'),
    '-');
$$;
```

`menu_upsert` then: guards on `menu.edit` exactly as `set_item_stock` does, validates `modifiers` through `valid_modifiers`, derives the slug when absent, requires `base_price >= 0`, inserts or updates by `id`, computes the changed-field diff with a `jsonb_object_agg` over the columns it touches, and writes one `staff_events` row with `action = 'menu.edit'`, `subject_id = <item id>` and the diff as `detail`.

`menu_reorder(p_actor, p_ids)` guards the same way and does `update menu_items set sort_order = idx - 1 from unnest(p_ids) with ordinality as t(id, idx) where menu_items.id = t.id`, auditing `menu.reorder` with the id array.

`menu_category_upsert` is the same pattern over `menu_categories`, including `vat_rate` and `earns_punch`.

Grants: `revoke all … from public, anon` and `grant execute … to authenticated` on all three, matching every other staff RPC.

- [ ] **Step 4: Run the test and commit**

Run: `supabase db reset && psql "$DATABASE_URL" -f supabase/tests/menu_admin.test.sql`
Expected: `NOTICE: menu_admin: all assertions passed`

```bash
supabase gen types typescript --local > types/supabase.ts
git add supabase/migrations/20260901093000_menu_admin.sql supabase/tests/menu_admin.test.sql types/supabase.ts
git commit -m "feat(menu): upsert, reorder and category RPCs behind menu.edit"
```

---

## Task 15: `lib/menu-admin.ts` and the actions

**Files:**
- Create: `lib/menu-admin.ts`, `lib/menu-admin.test.ts`
- Create: `app/dashboard/menu/actions.ts`

**Interfaces:**
- Produces: `type DraftItem` · `slugify(name)` · `validModifiers(groups)` · `diffItem(before, after)` · `saveItemAction(draft)` · `reorderItemsAction(ids)`

- [ ] **Step 1: Write the failing test**

```ts
// node --test lib/menu-admin.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { slugify, validModifiers } from "./menu-admin.ts";

test("the slug survives Romanian diacritics", () => {
  assert.equal(slugify("Cafea cu Lapte"), "cafea-cu-lapte");
  assert.equal(slugify("Șocolată  Caldă"), "socolata-calda");
  assert.equal(slugify("  Flat White  "), "flat-white");
});

test("a group with no options is not a group", () => {
  assert.equal(validModifiers([{ name: "Milk", required: true, options: [] }]), false);
});

test("an option needs a name and a numeric offset", () => {
  assert.equal(
    validModifiers([{ name: "Milk", required: true, options: [{ name: "Oat", priceOffset: 0.6 }] }]),
    true,
  );
  assert.equal(
    validModifiers([
      { name: "Milk", required: true, options: [{ name: "", priceOffset: 0 }] },
    ]),
    false,
  );
});

test("duplicate option names inside one group are refused", () => {
  assert.equal(
    validModifiers([
      {
        name: "Milk",
        required: true,
        options: [
          { name: "Oat", priceOffset: 0.6 },
          { name: "Oat", priceOffset: 0.8 },
        ],
      },
    ]),
    false,
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test lib/menu-admin.test.ts`
Expected: FAIL — `Cannot find module './menu-admin.ts'`

- [ ] **Step 3: Write the module and the actions**

`lib/menu-admin.ts` holds `DraftItem` (the sheet's whole form state), `slugify` (a `normalize("NFD")` + strip-combining-marks + kebab, no dependency), and `validModifiers` — the mirror of `valid_modifiers()`, whose only job is disabling the Save button before the round trip. Say so in the header comment, exactly as `lib/staff-permissions.ts` does about `staff_can`.

`app/dashboard/menu/actions.ts` follows `app/dashboard/actions.ts` line for line: `requireActor("menu.edit")`, `createClient()`, the `rpc` call, `fail(error)`, `slide(actor)`, then

```ts
    revalidatePath("/dashboard/menu");
    // The storefront is on revalidate = 30, so it would self-heal within half a
    // minute. A manager who changes a price and reloads expects to see it now.
    revalidatePath("/", "page");
```

Export `fail` and `slide` from `app/dashboard/actions.ts` rather than copying them.

- [ ] **Step 4: Run the test, typecheck, commit**

Run: `node --test lib/menu-admin.test.ts && pnpm exec tsc --noEmit`
Expected: PASS, no type errors

```bash
git add lib/menu-admin.ts lib/menu-admin.test.ts app/dashboard/menu/actions.ts app/dashboard/actions.ts
git commit -m "feat(menu): the draft-item shape and the save actions"
```

---

## Task 16: `/dashboard/menu`

**Files:**
- Create: `app/dashboard/menu/page.tsx`
- Create: `components/dashboard/menu/MenuAdminList.tsx`
- Modify: `components/dashboard/StaffBar.tsx` (a `Menu` link behind `menu.edit`)

**Interfaces:**
- Consumes: `saveItemAction`, `reorderItemsAction`, `DraftItem`
- Produces: the list, and the sheet's open/close state

- [ ] **Step 1: Build the page**

Server component. Redirects to `/dashboard/unlock` without an actor and to `/dashboard/board` without `menu.edit`, mirroring `app/dashboard/numbers/page.tsx:39-41`. Reads every category and every item — including `is_active = false` ones, which the storefront never sees and this page must.

- [ ] **Step 2: Build the list**

`MenuAdminList` is the storefront's editorial list in `kds-*`:

- A category pill rail at the top, `overflow-x-auto scrollbar-hide`, active pill driven by `layoutId="activeMenuCategory"` on `spring` — the same mechanism `CategoryNav` uses, and the same `aria-pressed` rather than links.
- `divide-y divide-kds-border border-y border-kds-border`, one `<li>` per item.
- Each row: a `<button>` filling the row opening the sheet, with the serif name and mono price on one `items-baseline justify-between` line, and beneath it the `/`-separated meta line — `PAR 12` or `UNLIMITED`, then `N LEFT` when `daily_stock` is low, then the allergens, then `OFF THE MENU` in `text-kds-text-secondary` when inactive (the whole row drops to `text-kds-text-secondary` in that case, exactly as a sold-out storefront row does).
- `↑ ↓` as two separate `size-9` buttons at the row's right edge, outside the main button so the row stays one accessible target. Each carries `aria-label="Move Cortado up"`. They call `reorderItemsAction` with the reordered id array and `router.refresh()`.
- A `+ Item` button in the rail opens the sheet with an empty draft in the active category.

- [ ] **Step 3: Verify and commit**

Run: `pnpm dev` as a manager, visit `/dashboard/menu`.
Expected: every item in the active category, inactive ones greyed with `OFF THE MENU`, and `↑ ↓` reordering that survives a reload and shows on the storefront within thirty seconds.

```bash
git add app/dashboard/menu components/dashboard/menu components/dashboard/StaffBar.tsx
git commit -m "feat(menu): the staff-side menu list"
```

---

## Task 17: The item sheet

**Files:**
- Create: `components/dashboard/menu/MenuItemSheet.tsx`
- Create: `components/dashboard/menu/ModifierEditor.tsx`

**Interfaces:**
- Consumes: `DraftItem`, `validModifiers`, `slugify`, `saveItemAction`, the dietary vocabulary from `lib/dietary.ts`

- [ ] **Step 1: Build the sheet**

Right-anchored slide-over, full height, no radius, `x: "100%" → 0` on `spring` inside `AnimatePresence`, over a backdrop tweened `opacity 0 → 1` at `duration: 0.2` in `bg-text-primary/25`. Copy the mechanics from `components/storefront/CartDrawer.tsx` — a staff drawer that moves differently from the customer drawer is two things to maintain and two things to learn. Add `useReducedMotion()`, degrading to `initial={false}`.

Fields, in the spec's order: name, slug (auto from name via `slugify` until the field is touched, then held), category `<select>`, price, par stock (blank means unlimited — say so in the mono note under it), description `<textarea>`, dietary and allergen `aria-pressed` pill toggles from `lib/dietary.ts`'s vocabulary, then the modifier editor, then the `ON THE MENU` toggle, then Save.

The price field shows the pending change beside it while it differs from the loaded value:

```tsx
        {draft.base_price !== initial.base_price && (
          <span className="ml-4 font-mono text-[11px] tracking-[0.14em] text-accent-primary uppercase tabular-nums">
            €{initial.base_price.toFixed(2)} → €{draft.base_price.toFixed(2)}
          </span>
        )}
```

Save is disabled while `!validModifiers(draft.modifiers)` or the name is empty, with the mono reason underneath rather than a silently inert button.

- [ ] **Step 2: Build the modifier editor**

`ModifierEditor` takes `groups` and `onChange`. Per group: a name input, a `REQUIRED` `aria-pressed` pill, a `✕` removing the group, then one row per option — name input, offset input prefixed `€`, `✕` — and a `+ Option` button. `+ Group` sits above. All plain inputs on hairline underlines; no drag, no library.

- [ ] **Step 3: Verify against a real order**

Run: `pnpm dev`. Add a `Syrup` group with `None €0.00` and `Vanilla €0.70` to an item, save, then order that item from the storefront choosing Vanilla.
Expected: the modifier appears in `ModifierSheet`, the price rises by €0.70, and `create_order` accepts it. This is the test that matters — a modifier group the editor writes and `order_lines()` rejects is the exact failure `valid_modifiers` exists to prevent.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/menu
git commit -m "feat(menu): the item sheet and the modifier editor"
```

---

# Phase E — Receipts

## Task 18: `order_receipt()` and the email columns

**Files:**
- Create: `supabase/migrations/20260901094000_receipts.sql`

**Interfaces:**
- Produces: `orders.receipt_email`, `orders.receipt_sent_at` · `order_receipt(p_token uuid) returns jsonb` · `set_receipt_email(p_token uuid, p_email text) returns boolean`

- [ ] **Step 1: Write the migration**

```sql
-- The receipt.
--
-- NOT a bon fiscal: that must come from certified fiscal hardware registered
-- with ANAF, and no web app can mint one. This is a commercial receipt — a
-- correct, itemised proof of purchase with a VAT breakdown, which is what the
-- customer wants and what the accountant reconciles against. The copy on the
-- page says so, and it must keep saying so.

alter table orders
  add column receipt_email   text check (receipt_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  -- Makes the send idempotent under a Stripe webhook retry.
  add column receipt_sent_at timestamptz;

-- The same projection order_by_token() makes, plus everything a receipt needs.
-- One function rather than widening order_by_token(): the confirmation page
-- should not be shipping tax and tender to a screen that does not draw them.
create function order_receipt(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',              o.id,
    'day_number',      o.day_number,
    'order_number',    o.order_number,
    'status',          o.status,
    'customer_name',   o.customer_name,
    'placed_at',       o.placed_at,
    'payment_method',  o.payment_method,
    'settled_as',      o.settled_as,
    'subtotal',        o.subtotal,
    'discount_total',  o.discount_total,
    'discount_reason', o.discount_reason,
    'total',           o.total,
    'tax_total',       o.tax_total,
    'receipt_email',   o.receipt_email,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item_name',          i.item_name,
               'quantity',           i.quantity,
               'selected_modifiers', i.selected_modifiers,
               'line_total',         i.line_total,
               'vat_rate',           i.vat_rate
             ) order by i.created_at, i.id)
        from order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from orders o
  where o.access_token = p_token;
$$;

-- The guest's own address, against their own order. The token is the credential,
-- exactly as it is for order_by_token() and cancel_order_by_token().
create function set_receipt_email(p_token uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  update orders set receipt_email = nullif(btrim(lower(p_email)), '')
   where access_token = p_token
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

grant execute on function order_receipt(uuid) to anon, authenticated;
grant execute on function set_receipt_email(uuid, text) to anon, authenticated;
```

- [ ] **Step 2: Verify by hand**

Run: `psql "$DATABASE_URL" -c "select order_receipt((select access_token from orders limit 1));"`
Expected: a jsonb object carrying `tax_total`, `settled_as` and per-line `vat_rate`.

- [ ] **Step 3: Commit**

```bash
supabase gen types typescript --local > types/supabase.ts
git add supabase/migrations/20260901094000_receipts.sql types/supabase.ts
git commit -m "feat(receipt): the receipt projection and the guest's email"
```

---

## Task 19: `lib/shop.ts`, `lib/receipt.ts`, `lib/email.ts`

**Files:**
- Create: `lib/shop.ts`, `lib/receipt.ts`, `lib/receipt.test.ts`, `lib/email.ts`

**Interfaces:**
- Produces: `SHOP` · `receiptText(receipt)` · `sendEmail({ to, subject, text })`

- [ ] **Step 1: Write the failing test**

```ts
// node --test lib/receipt.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { receiptText } from "./receipt.ts";
import type { Receipt } from "./receipt.ts";

const receipt: Receipt = {
  day_number: 42,
  placed_at: "2026-09-02T05:14:00.000Z",
  settled_as: "cash",
  payment_method: "counter",
  subtotal: 13.2,
  discount_total: 1,
  discount_reason: "Spilled it",
  total: 12.2,
  tax_total: 1.21,
  items: [
    {
      item_name: "Cortado",
      quantity: 2,
      line_total: 8.4,
      vat_rate: 0.11,
      selected_modifiers: [{ group: "Milk", option: "Oat Milk", priceOffset: 0.6 }],
    },
  ],
};

test("the receipt names the shop and the ticket", () => {
  const text = receiptText(receipt);
  assert.match(text, /KROMA COFFEE & BAKEHOUSE/);
  assert.match(text, /#042/);
});

test("every line, its modifiers and its money are present", () => {
  const text = receiptText(receipt);
  assert.match(text, /2 × CORTADO\s+€8\.40/);
  assert.match(text, /OAT MILK/);
});

test("the discount is shown as a subtraction with its reason", () => {
  const text = receiptText(receipt);
  assert.match(text, /DISCOUNT\s+−€1\.00/);
  assert.match(text, /SPILLED IT/);
});

test("VAT is stated as included, never added", () => {
  const text = receiptText(receipt);
  assert.match(text, /TOTAL\s+€12\.20/);
  assert.match(text, /INCL\. VAT 11%\s+€1\.21/);
});

test("it says plainly that it is not a fiscal receipt", () => {
  assert.match(receiptText(receipt), /NOT A FISCAL RECEIPT/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test lib/receipt.test.ts`
Expected: FAIL — `Cannot find module './receipt.ts'`

- [ ] **Step 3: Write the three modules**

`lib/shop.ts` — plain constants; the VAT number from `process.env.NEXT_PUBLIC_SHOP_VAT_ID` with a placeholder fallback, everything else literal from CLAUDE.md §1. A `ponytail:` comment naming the upgrade path: a `shop_settings` row read by `shop.settings` the day there are two shops.

`lib/receipt.ts` — the `Receipt` type mirroring `order_receipt()`, and `receiptText()` building the monospace document as a plain string. One builder for both surfaces: the page renders it inside `<pre>` and the email sends it as `text`, so the two can never drift.

`lib/email.ts`:

```ts
import "server-only";

/**
 * One POST to Resend. No SDK: this is a single endpoint with a JSON body, and a
 * client library here would be tens of kilobytes to avoid nine lines.
 *
 * ponytail: no retry and no queue. A failed send logs and returns false — the
 * receipt link on the order page is the source of truth and the email is a
 * convenience. If sends ever start mattering, put them behind Vercel Queues.
 */
export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("RESEND_API_KEY is not set — not sending", message.subject);
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.RECEIPT_FROM ?? "KROMA <bar@kroma.coffee>",
        ...message,
      }),
    });
    if (!response.ok) console.error("email rejected:", response.status, await response.text());
    return response.ok;
  } catch (error) {
    console.error("email failed:", error);
    return false;
  }
}
```

- [ ] **Step 4: Run the test and commit**

Run: `node --test lib/receipt.test.ts`
Expected: PASS, 5 tests

```bash
git add lib/shop.ts lib/receipt.ts lib/receipt.test.ts lib/email.ts
git commit -m "feat(receipt): the document body, the shop's details and a Resend send"
```

---

## Task 20: `/order/[token]/receipt`

**Files:**
- Create: `app/order/[token]/receipt/page.tsx`
- Modify: `app/globals.css` (the print block)
- Modify: `components/checkout/OrderStatus.tsx` (a `Receipt` link once paid)
- Modify: `components/account/OrderRow.tsx` (the same link)

- [ ] **Step 1: Build the page**

A server component guarding the token with the same UUID regex `app/order/[token]/page.tsx:12` uses, calling `order_receipt`, `notFound()` on null. It renders `receiptText()` inside a `<pre className="font-mono text-[12px] leading-[1.7] whitespace-pre">` in a `max-w-[380px] mx-auto` column on `bg-surface-canvas`, with a `Print` button and a `← Your order` link above it — both `print:hidden`.

- [ ] **Step 2: Add the print rules**

In `app/globals.css`:

```css
/* The receipt is a document, not a page. 58mm is the common thermal roll. */
@media print {
  @page {
    size: 58mm auto;
    margin: 4mm;
  }
  body {
    background: #fff;
  }
  .print\:hidden {
    display: none !important;
  }
}
```

- [ ] **Step 3: Verify**

Run: `pnpm dev`, place an order, open `/order/<token>/receipt`, print to PDF.
Expected: a 58mm-wide slip with no header, no footer and no print button; on screen, a centred monospace document reading exactly as `receiptText` builds it, ending with the `NOT A FISCAL RECEIPT` line.

- [ ] **Step 4: Commit**

```bash
git add app/order/[token]/receipt app/globals.css components/checkout/OrderStatus.tsx components/account/OrderRow.tsx
git commit -m "feat(receipt): a printable receipt page"
```

---

## Task 21: The email field, and sending on paid

**Files:**
- Modify: `components/checkout/CheckoutForm.tsx` (the field)
- Modify: `app/checkout/actions.ts:36-60` (carry the address)
- Modify: `supabase/migrations/20260901094000_receipts.sql` (`create_order` takes `p_receipt_email`)
- Modify: `lib/payment.ts:38-50` (pass it through from Stripe metadata; send after placing)
- Modify: `app/dashboard/actions.ts` (send after a counter order reaches `paid`)
- Create: `lib/send-receipt.ts`

**Interfaces:**
- Produces: `sendReceipt(orderId)` — idempotent through `receipt_sent_at`

- [ ] **Step 1: Add the field**

In `CheckoutForm`, under the name field, rendered only when `!signedIn`:

```tsx
        <label className="mt-10 block">
          <span className={LABEL}>Email for the receipt</span>
          <input
            type="email"
            maxLength={160}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Optional"
            className={FIELD}
          />
          <span className="mt-3 block font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
            Optional — for the receipt and a ping when it&rsquo;s ready.
          </span>
        </label>
```

`email` joins the `DETAILS_KEY` session storage payload beside `name` and `notes`, so it survives the round trip to Stripe. Signed-in customers never see it; `create_order` falls back to their `auth.users.email`.

- [ ] **Step 2: Carry it to the order**

`create_order` gains `p_receipt_email text default null` (last, after every other defaulted parameter — Postgres requires it) and writes it. `placeOrder` passes it for counter orders and packs it into the Stripe session metadata for card orders, where `placeOrderFromSession` reads it back alongside `customer_name`.

- [ ] **Step 3: Write `sendReceipt`**

```ts
import "server-only";

import { admin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { receiptText, type Receipt } from "@/lib/receipt";

/**
 * Idempotent by receipt_sent_at, which is what makes a Stripe webhook retry
 * harmless. Returns quietly on every failure: an order is not less placed
 * because an email bounced.
 */
export async function sendReceipt(orderId: string): Promise<void> {
  const db = admin();
  const { data } = await db
    .from("orders")
    .select("access_token, receipt_email, receipt_sent_at, user_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!data || data.receipt_sent_at) return;

  const to = data.receipt_email ?? (await addressOf(data.user_id));
  if (!to) return;

  const { data: receipt } = await db.rpc("order_receipt", { p_token: data.access_token });
  if (!receipt) return;

  const sent = await sendEmail({
    to,
    subject: `KROMA — order #${String((receipt as Receipt).day_number).padStart(3, "0")}`,
    text: receiptText(receipt as Receipt),
  });

  if (sent) {
    await db.from("orders").update({ receipt_sent_at: new Date().toISOString() }).eq("id", orderId);
  }
}
```

`addressOf` reads `auth.admin.getUserById` for signed-in customers.

- [ ] **Step 4: Call it at both `paid` moments**

In `lib/payment.ts`, after a successful `create_order`. In `advanceOrderAction`, after a successful transition when `to === "paid"`. Both fire-and-forget with a `void` and a `.catch(console.error)` — a receipt must never block the pass.

- [ ] **Step 5: Verify**

Run: `pnpm dev` with `RESEND_API_KEY` set. Place a counter order with an email, mark it `Cash` on the board.
Expected: the receipt lands in the inbox as plain text identical to the page, and `receipt_sent_at` is set. Marking it paid again (step back, step forward) sends nothing further.

- [ ] **Step 6: Commit**

```bash
git add components/checkout/CheckoutForm.tsx app/checkout/actions.ts lib/payment.ts lib/send-receipt.ts app/dashboard/actions.ts supabase/migrations/20260901094000_receipts.sql
git commit -m "feat(receipt): email the receipt when the order is paid"
```

---

# Phase F — Discounts and comps

## Task 22: `discount_order()`

**Files:**
- Create: `supabase/migrations/20260901095000_discounts.sql`
- Create: `supabase/tests/discount.test.sql`

**Interfaces:**
- Consumes: `orders.discount_total` (added in the Phase C migration), `tax_total`
- Produces: `orders.discount_reason` · `discount_order(p_order_id, p_actor, p_kind, p_value, p_reason, p_station) returns jsonb`

- [ ] **Step 1: Write the failing test**

```sql
  -- a barista may not discount
  begin;
    perform discount_order(v_order.id, v_barista, 'percent', 10, 'Because');
    assert false, 'a barista may not discount';
  exception when sqlstate 'P0001' then
    assert sqlerrm = 'Not yours to do.', 'and is told so';
  end;

  -- a reason is not optional
  begin;
    perform discount_order(v_order.id, v_manager, 'percent', 10, '  ');
    assert false, 'a discount without a reason is not a discount';
  exception when sqlstate 'P0001' then
    assert sqlerrm like 'A reason%', 'and it asks for one';
  end;

  -- percent
  perform discount_order(v_order.id, v_manager, 'percent', 10, 'Spilled it');
  assert (select total from orders where id = v_order.id) = 9.00, '10% off 10.00';
  assert (select discount_total from orders where id = v_order.id) = 1.00, 'recorded';
  -- VAT follows the money down
  assert (select tax_total from orders where id = v_order.id)
       = round(0.99 * 0.9, 2), 'tax is prorated, not left at the old total';

  -- replaces, never stacks
  perform discount_order(v_order.id, v_manager, 'percent', 10, 'Spilled it');
  assert (select total from orders where id = v_order.id) = 9.00,
         'a second identical discount is not a second discount';

  -- comp
  perform discount_order(v_order.id, v_manager, 'comp', 0, 'On the house');
  assert (select total from orders where id = v_order.id) = 0, 'a comp is the lot';

  -- a settled order is closed to it
  perform advance_order(v_order.id, 'cancelled', v_manager);
  begin;
    perform discount_order(v_order.id, v_manager, 'percent', 10, 'Too late');
    assert false, 'a voided order cannot be discounted';
  exception when sqlstate 'P0001' then null;
  end;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `psql "$DATABASE_URL" -f supabase/tests/discount.test.sql`
Expected: FAIL — `function discount_order(...) does not exist`

- [ ] **Step 3: Write the function**

The body, in order: read the actor fresh and check `is_active`/`kind`; `staff_can(role, 'order.discount')`; `select … for update` on the order; refuse `cancelled` and `refunded`; require `btrim(p_reason)` of at least three characters — *"A reason, so the ledger means something."*; resolve the amount by kind, clamped to `[0, subtotal]`:

```sql
  v_amount := round(case p_kind
    when 'percent' then v_order.subtotal * least(greatest(p_value, 0), 100) / 100
    when 'amount'  then least(greatest(p_value, 0), v_order.subtotal)
    when 'comp'    then v_order.subtotal
    else null end, 2);

  if v_amount is null then
    raise exception 'Unknown discount.' using errcode = 'P0001';
  end if;
```

then write `discount_total`, `discount_reason`, `total = subtotal - v_amount`, and

```sql
  -- The tax follows the money down. Prorating the order's total rather than
  -- re-deriving per line is deliberate: a discount is not attributable to a
  -- line, and splitting it across mixed rates would be inventing a fact.
  -- ponytail: exact per-line apportionment if the shop ever sells at two rates
  -- in one order.
      tax_total = round(v_order.tax_total
                        * case when v_order.subtotal = 0 then 0
                               else (v_order.subtotal - v_amount) / v_order.subtotal end, 2)
```

then the audit row, and finally the return:

```sql
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
```

Add `discount_reason` and project `discount_total` / `discount_reason` from `staff_order()` in the same migration.

- [ ] **Step 4: Run the test and commit**

Run: `supabase db reset && psql "$DATABASE_URL" -f supabase/tests/discount.test.sql`
Expected: `NOTICE: discount: all assertions passed`

```bash
supabase gen types typescript --local > types/supabase.ts
git add supabase/migrations/20260901095000_discounts.sql supabase/tests/discount.test.sql types/supabase.ts
git commit -m "feat(discount): comps and discounts with a mandatory reason"
```

---

## Task 23: The sheet and the partial refund

**Files:**
- Create: `lib/discount.ts`, `lib/discount.test.ts`
- Create: `components/dashboard/DiscountSheet.tsx`
- Modify: `lib/refund.ts` (an `amount` parameter)
- Modify: `app/dashboard/actions.ts` (`discountOrderAction`)
- Modify: `components/dashboard/OrderDetail.tsx` (the button), `components/dashboard/OrderRow.tsx` (the line)

**Interfaces:**
- Produces: `previewDiscount(subtotal, kind, value)` · `discountOrderAction(orderId, kind, value, reason)` · `refundOrder(orderId, amountEuros?)`

- [ ] **Step 1: Write the failing test**

```ts
// node --test lib/discount.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { previewDiscount } from "./discount.ts";

test("a percentage comes off the subtotal, rounded to the cent", () => {
  assert.deepEqual(previewDiscount(14.6, "percent", 10), { off: 1.46, total: 13.14 });
});

test("an amount never takes the total below zero", () => {
  assert.deepEqual(previewDiscount(4.2, "amount", 10), { off: 4.2, total: 0 });
});

test("a comp is the lot", () => {
  assert.deepEqual(previewDiscount(14.6, "comp", 0), { off: 14.6, total: 0 });
});

test("a negative value is not a discount", () => {
  assert.deepEqual(previewDiscount(14.6, "amount", -5), { off: 0, total: 14.6 });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test lib/discount.test.ts`
Expected: FAIL — `Cannot find module './discount.ts'`

- [ ] **Step 3: Write the module**

`previewDiscount` mirrors the SQL clamp exactly. Header comment: *"The mirror of discount_order()'s arithmetic, and its only job is drawing the before/after line before the round trip. The database is the authority on what a discount is."*

- [ ] **Step 4: Widen `refundOrder`**

```ts
export async function refundOrder(orderId: string, amountEuros?: number): Promise<RefundResult> {
```

and pass `amount: Math.round(amountEuros * 100)` to `stripe.refunds.create` when it is given. Change the idempotency key to `refund_${orderId}_${cents ?? "all"}` — a partial refund and a later full one are two different refunds, and reusing one key would silently make the second a no-op. Add that as a comment; it is the kind of line that gets "simplified" back.

- [ ] **Step 5: Write the action and the sheet**

`discountOrderAction` follows `advanceOrderAction` exactly, including the post-commit refund:

```ts
    const owed = (data as { refund_owed?: number } | null)?.refund_owed ?? 0;
    if (owed > 0) {
      const refund = await refundOrder(orderId, owed);
      if (!refund.ok) return { ok: false, error: refund.error };
    }
```

`DiscountSheet` is the same slide-over mechanics as the menu sheet: four preset `aria-pressed` pills (`10%`, `20%`, `50%`, `COMP`) with a `layoutId="activeDiscount"` fill on `spring`, an amount field that clears the preset when typed into, a required reason input, and the live before/after line through `AnimatePresence mode="popLayout"` + `numberTransition`:

```tsx
        <p className="mt-8 font-mono text-[11px] font-medium tracking-[0.14em] text-accent-primary uppercase">
          Takes €{order.total.toFixed(2)} to{" "}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={preview.total} {...numberTransition} className="inline-block tabular-nums">
              €{preview.total.toFixed(2)}
            </motion.span>
          </AnimatePresence>
        </p>
```

Apply is disabled until `reason.trim().length >= 3`, with `A reason, so the ledger means something.` in mono underneath.

- [ ] **Step 6: Draw it on the board**

In `OrderRow`, when `order.discount_total > 0`, one extra mono line under the item summary:

```tsx
          <p className="mt-2 font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
            {order.total === 0 ? "Comped" : `−€${order.discount_total.toFixed(2)}`}
            <span aria-hidden className="mx-3 text-kds-border">/</span>
            {order.discount_reason}
          </p>
```

A comped order that looks identical to a paid one is how a shop loses money quietly.

- [ ] **Step 7: Verify**

Run: `pnpm dev`. Pay a €14.60 card order online, then discount it 10% as a manager.
Expected: the sheet previews `€14.60 → €13.14`, the order total becomes €13.14, `tax_total` drops proportionally, the board row shows `−€1.46 / SPILLED IT`, and Stripe shows a €1.46 partial refund against the original intent.

- [ ] **Step 8: Commit**

```bash
git add lib/discount.ts lib/discount.test.ts lib/refund.ts components/dashboard app/dashboard/actions.ts
git commit -m "feat(discount): the discount sheet and partial refunds"
```

---

# Phase G — Ready notifications

## Task 24: Subscriptions, keys and the sender

**Files:**
- Create: `supabase/migrations/20260901096000_push.sql`
- Create: `lib/push.ts`
- Create: `public/sw.js`
- Modify: `package.json` (add `web-push`)
- Modify: `app/api/cron/release-holds/route.ts` (sweep old subscriptions)

**Interfaces:**
- Produces: `order_push_subscriptions` · `subscribe_order_push(p_token uuid, p_endpoint text, p_p256dh text, p_auth text) returns boolean` · `notifyReady(orderId)`

- [ ] **Step 1: Write the migration**

The table exactly as the spec has it, plus:

```sql
-- The token is the credential, as it is for every other guest-facing RPC here.
-- A subscription is scoped to ONE order, which is the whole design: no
-- preference screen, no unsubscribe flow, and no endpoints accumulating for a
-- customer who has not visited since March. The row dies with the order.
create function subscribe_order_push(
  p_token    uuid,
  p_endpoint text,
  p_p256dh   text,
  p_auth     text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order uuid;
begin
  select id into v_order from orders
   where access_token = p_token
     and status in ('pending','paid','preparing');
  if v_order is null then return false; end if;

  insert into order_push_subscriptions (order_id, endpoint, p256dh, auth)
  values (v_order, p_endpoint, p_p256dh, p_auth)
  on conflict (order_id, endpoint) do nothing;

  return true;
end;
$$;

alter table order_push_subscriptions enable row level security;
-- No policy at all: only the subscribe RPC writes, and only the service role
-- (lib/push.ts) reads, exactly as the stripe_* columns are handled.

grant execute on function subscribe_order_push(uuid, text, text, text) to anon, authenticated;
```

- [ ] **Step 2: Add the dependency and the keys**

```bash
pnpm add web-push
pnpm exec web-push generate-vapid-keys
```

Put the pair in `.env.local` as `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (the public one twice — the browser needs it and the server signs with it), plus `VAPID_SUBJECT=mailto:bar@kroma.coffee`. Add all four with `vercel env add` for preview and production.

- [ ] **Step 3: Write `lib/push.ts` and the worker**

`lib/push.ts` is `server-only`: it reads the order's subscriptions with `admin()`, calls `webpush.sendNotification` for each, and **deletes any endpoint that returns 404 or 410** — a dead endpoint that is never cleaned up is how a push table rots. Falls back to `sendEmail` when the order has an address and no live subscription.

`public/sw.js` is nine lines:

```js
// Nothing else lives in this worker. It is not a cache, it is not offline
// support — it exists because Web Push requires a service worker to receive.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "KROMA", {
      body: data.body ?? "Ready at the bar.",
      badge: "/icon.png",
      icon: "/icon.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

- [ ] **Step 4: Sweep in the existing cron**

One statement added to `app/api/cron/release-holds/route.ts`, with a comment saying why it lives there rather than in its own cron: the Hobby plan allows one daily cron and this job already runs.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260901096000_push.sql lib/push.ts public/sw.js package.json pnpm-lock.yaml app/api/cron/release-holds/route.ts
git commit -m "feat(notify): web-push subscriptions scoped to one order"
```

---

## Task 25: The button, and firing on ready

**Files:**
- Create: `components/checkout/NotifyButton.tsx`
- Modify: `app/order/actions.ts` (append `subscribeToOrderAction`, `setReceiptEmailAction`)
- Modify: `app/order/[token]/page.tsx` (render it)
- Modify: `app/dashboard/actions.ts` (fire on `ready`)

- [ ] **Step 1: Write the button**

Three states, decided on mount:

- `"serviceWorker" in navigator && "PushManager" in window` and permission `default` → `Tell me when it's ready`, which registers `/sw.js`, calls `Notification.requestPermission()`, subscribes with the public VAPID key, and posts the subscription through `subscribeToOrderAction`.
- Permission `granted` → `We'll ping you.` in `text-badge-live`.
- Permission `denied`, or no `PushManager` (iOS Safari outside a home-screen app — a large share of the people standing in a café) → an email field and `Email me when it's ready`, posting through `setReceiptEmailAction`. Same position, same weight, one working path on every device.

Never call `Notification.requestPermission()` on mount. It must be behind the tap, or Safari and Chrome both silently deny it.

- [ ] **Step 2: Fire it**

In `advanceOrderAction`, after a successful transition:

```ts
    // The pass does not wait on a notification. Fire and forget; a failed push
    // is not a failed transition, and the order page's own poll still works.
    if (to === "ready") void notifyReady(orderId).catch(console.error);
```

- [ ] **Step 3: Verify on two devices**

Run: `pnpm dev` over HTTPS (`vercel dev` or a preview deploy — Web Push needs a secure origin; `localhost` counts, a LAN IP does not). Place an order in Chrome, press the button, grant permission, then move the order to `ready` from the dashboard.
Expected: a system notification within a second or two, clicking it opens the order page. On an iPhone in Safari, the same spot shows the email field instead, and the email arrives.

- [ ] **Step 4: Commit**

```bash
git add components/checkout/NotifyButton.tsx app/order app/dashboard/actions.ts
git commit -m "feat(notify): tell the customer when the order is on the bar"
```

---

# Final verification

- [ ] **Every test, once**

```bash
node --test lib/*.test.ts
supabase db reset
for f in supabase/tests/*.test.sql; do echo "== $f"; psql "$DATABASE_URL" -f "$f" || break; done
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

- [ ] **One full day, by hand**

1. Open the board with the day closed — the opening screen appears. Unlock, adjust one bake count, open.
2. Order two items from the storefront as a guest with an email. Mark the order `Cash`; the receipt arrives; `/order/<token>/receipt` prints at 58mm.
3. Order online with a card. Press the notify button. Move it to `ready` — the notification lands.
4. Discount that order 10% with a reason. Stripe shows a partial refund; the board row shows the reason.
5. Change a price on `/dashboard/menu`; the storefront reflects it.
6. Try to close the day with one order still on the pass — the close screen names it and links to it. Resolve it.
7. Count the drawer to the euro. `SQUARE`. Close.
8. Reload the storefront — `CLOSED`, and `/checkout` refuses.
9. `select day, day_number, settled_as, tax_total, discount_total from orders where service_day = current_date order by day_number;` — every column populated, tickets starting at 1.
