# KROMA Customer Dashboard & Loyalty Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-page `/account` with a four-page account area (Overview, Orders + detail, Card, Settings) and add a 12-punch loyalty card that is earned on every drink and redeemed at checkout.

**Architecture:** The punch balance is never stored. `card_punches(uuid)` derives it from `order_items` marked `earns_punch` on non-cancelled orders, minus rows in `card_redemptions`, plus a constant 2-punch signup grant. Refunds therefore self-heal with no reversal path. Redemption arithmetic lives in `order_lines()` — the one function both `quote_order` (which prices the Stripe session) and `create_order` (which writes the order) already call — so what the card is charged and what the order stores cannot disagree. The burn itself happens inside `create_order` under `pg_advisory_xact_lock` on the user id, in the same transaction as the stock decrement.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (hosted, Postgres + RLS), Stripe Checkout, Tailwind v4, Framer Motion, `node --test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-08-19-account-dashboard-design.md`

## Global Constraints

- **Branch:** all work lands on `feat/checkout`, already checked out.
- **Migrations run against the HOSTED Supabase project.** Apply with the Supabase MCP `apply_migration` tool (it applies *and* records), and save identical SQL under `supabase/migrations/` so the repo stays the source of truth. There is no local Supabase.
- **SQL tests run against the hosted database wrapped in `begin … rollback`.** Nothing may persist. Run them with the Supabase MCP `execute_sql` tool.
- **TypeScript tests run with `node --test <file>`.** No framework. Node 24 strips types natively. Every test file opens with a `// node --test <path>` comment, matching `lib/cart.test.ts`.
- **Never send prices from the client.** The redeem argument is a `menu_item_id` only — never a discount amount. The database recomputes every number.
- **Money is `numeric` everywhere in SQL.** Convert to integer cents exactly once, at the Stripe boundary.
- **`my_card()` and `my_usual()` take no user argument.** They read `auth.uid()`. `card_punches(uuid)` is internal and revoked from `anon, authenticated`.
- **Brand rules are not optional.** Follow `CLAUDE.md` — page gutter `px-5 sm:px-10 lg:px-14`; structure from `border-hairline` rules, never cards; every label, price and badge is mono-uppercase at the tracking from the ladder; only `rounded-full`, `rounded-sm`, `rounded-lg`; motion tokens imported from `lib/motion.ts` and `lib/reveal.ts`, never inlined; focus is always `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus`.
- **Copy is operational, never e-commerce.** Never "Rewards", never "Loyalty Program", never an exclamation mark. The card is "your card"; punches are "cups".
- **Prices render `€${n.toFixed(2)}` with `tabular-nums`.**
- **Lint after every task:** `pnpm lint` must pass before committing.

## Three discoveries that adjust the spec

1. **The discount belongs in `order_lines`, not in `create_order`.** The spec describes the redeem branch as living in `create_order`, but `quote_order` also needs the discounted total or Stripe charges full price. Both already delegate to `order_lines()`. Passing `p_redeem_item_id` down to `order_lines` puts the arithmetic in exactly one place, which is the same reason the pricing loop was lifted there in the first place (see the header comment of `20260819091905_pay_before_order.sql`). `create_order` keeps the *authorisation* — the lock and the balance check — and `order_lines` does the *arithmetic*.

2. **`quote_order` must check the balance too.** It is granted to `authenticated`, so without a check a customer could pass a `redeem_item_id` with an empty card and get a discounted Stripe session. The card is verified in both functions.

3. **The free cup earns its own punch.** The spec did not address this. Tracking a partial exclusion on a line of quantity 3 (one free, two paid) needs per-unit punch accounting that buys nothing real. The free cup is a real cup, so it counts. The economics shift from 12 paid cups per free drink to 11 after the first card — immaterial here, and it keeps the balance a plain `sum()`. Marked with a `ponytail:` comment in the migration.

## Phasing

- **Phase A — data (Tasks 1-3).** Schema and SQL functions. Nothing user-visible.
- **Phase B — the account area (Tasks 4-10).** Shell and four pages. Ships without the checkout change; the Card page is read-only until Phase C.
- **Phase C — money and storefront (Tasks 11-12).** The checkout redeem path, then favourites.

Phase C touches code that handles money and comes last on purpose.

---

### Task 1: `profiles` and `favourites` tables

**Files:**
- Create: `supabase/migrations/20260819120000_profiles_and_favourites.sql`
- Create: `supabase/tests/profiles.test.sql`
- Apply: hosted Supabase, via MCP `apply_migration`

**Interfaces:**
- Consumes: `auth.users`, `menu_items`, the existing `set_updated_at()` trigger function from `20260815120000_init_menu_and_orders.sql`
- Produces: tables `profiles` (`id`, `display_name`, `phone`, `dietary_tags`, `marketing_opt_in`, `created_at`, `updated_at`) and `favourites` (`user_id`, `menu_item_id`, `created_at`)

- [ ] **Step 1: Write the failing SQL test**

```sql
-- supabase/tests/profiles.test.sql
-- Run against the hosted database, inside begin/rollback.
begin;

-- Two users, so the policies have something to keep apart.
insert into auth.users (id, instance_id, aud, role, email)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'b@example.test');

insert into profiles (id, display_name, phone)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Ana', '+40700000001');

do $$
declare
  v_seen integer;
  v_name text;
begin
  ------------------------------------------------------------- 1. own row
  set local role authenticated;
  set local request.jwt.claims =
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

  select count(*) into v_seen from profiles;
  assert v_seen = 1, format('A should see exactly its own profile, saw %s', v_seen);

  update profiles set display_name = 'Ana M' where id = auth.uid();
  select display_name into v_name from profiles where id = auth.uid();
  assert v_name = 'Ana M', 'A must be able to update its own profile';

  ---------------------------------------------------- 2. somebody else's row
  set local request.jwt.claims =
    '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

  select count(*) into v_seen from profiles;
  assert v_seen = 0, format('B must not see A''s profile, saw %s', v_seen);

  update profiles set display_name = 'stolen'
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  select display_name into v_name from profiles
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  -- read back as the owner, since B cannot see the row at all
  set local request.jwt.claims =
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
  select display_name into v_name from profiles where id = auth.uid();
  assert v_name = 'Ana M', 'B must not be able to write A''s profile';

  ------------------------------------------------------------ 3. favourites
  set local request.jwt.claims =
    '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
  insert into favourites (user_id, menu_item_id)
  select auth.uid(), id from menu_items limit 1;

  select count(*) into v_seen from favourites;
  assert v_seen = 1, format('B should see its own favourite, saw %s', v_seen);

  set local request.jwt.claims =
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
  select count(*) into v_seen from favourites;
  assert v_seen = 0, format('A must not see B''s favourites, saw %s', v_seen);

  reset role;
  raise notice 'profiles.test.sql passed';
end;
$$;

rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run the file through the Supabase MCP `execute_sql` tool.
Expected: FAIL with `relation "profiles" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260819120000_profiles_and_favourites.sql
-- Somewhere for a customer's own details to live. Until now the only record of
-- a person was auth.users plus whatever name they typed at the bar each time.

create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text,
  phone            text,
  dietary_tags     text[] not null default '{}',
  marketing_opt_in boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Saved items, for the Overview row. Deliberately a join table and nothing
-- more: no notes, no ordering, no folders.
create table favourites (
  user_id      uuid not null references auth.users(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, menu_item_id)
);

alter table profiles   enable row level security;
alter table favourites enable row level security;

-- No signup trigger creating a profile row: the app reads with maybeSingle()
-- and treats null as empty, so the first save upserts. One less thing to keep
-- in sync with auth.
create policy "profiles read own"   on profiles for select using (auth.uid() = id);
create policy "profiles insert own" on profiles for insert with check (auth.uid() = id);
create policy "profiles update own" on profiles for update using (auth.uid() = id);

create policy "favourites read own"   on favourites for select using (auth.uid() = user_id);
create policy "favourites insert own" on favourites for insert with check (auth.uid() = user_id);
create policy "favourites delete own" on favourites for delete using (auth.uid() = user_id);
```

- [ ] **Step 4: Apply and re-run the test**

Apply with MCP `apply_migration`, name `profiles_and_favourites`.
Then run `supabase/tests/profiles.test.sql` through `execute_sql`.
Expected: `NOTICE: profiles.test.sql passed`.

- [ ] **Step 5: Regenerate types**

Run the Supabase MCP `generate_typescript_types` tool and write the result over `types/supabase.ts`.
Verify: `npx tsc --noEmit` passes.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260819120000_profiles_and_favourites.sql supabase/tests/profiles.test.sql types/supabase.ts
git commit -m "feat(db): add profiles and favourites tables with own-row RLS"
```

---

### Task 2: Punch counting

**Files:**
- Create: `supabase/migrations/20260819121000_card.sql`
- Create: `supabase/tests/card.test.sql`
- Apply: hosted Supabase, via MCP `apply_migration`

**Interfaces:**
- Consumes: `menu_categories`, `order_items`, `orders`, `menu_items` from Task 1's predecessors
- Produces: `menu_categories.earns_punch`, `order_items.earns_punch`, table `card_redemptions`, functions `card_punches(uuid) returns integer`, `my_card() returns jsonb` (`{punches, ready, redeemed_count}`), `my_usual() returns jsonb` (`{menu_item_id, name, base_price, daily_stock, image_url, times_ordered, selected_modifiers}` or null)

- [ ] **Step 1: Write the failing SQL test**

```sql
-- supabase/tests/card.test.sql
-- Run against the hosted database, inside begin/rollback.
begin;

insert into auth.users (id, instance_id, aud, role, email)
values ('cccccccc-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'c@example.test');

insert into menu_categories (id, slug, name, earns_punch)
values ('44444444-4444-4444-4444-444444444444', 'test-drinks', 'Test Drinks', true),
       ('55555555-5555-5555-5555-555555555555', 'test-food',   'Test Food',   false);

insert into menu_items (id, category_id, slug, name, base_price, daily_stock, modifiers)
values
  ('66666666-6666-6666-6666-666666666666',
   '44444444-4444-4444-4444-444444444444',
   'test-cortado', 'Test Cortado', 4.20, null, '[]'::jsonb),
  ('77777777-7777-7777-7777-777777777777',
   '55555555-5555-5555-5555-555555555555',
   'test-bun2', 'Test Bun', 3.50, null, '[]'::jsonb);

do $$
declare
  v_user  uuid := 'cccccccc-0000-0000-0000-000000000003';
  v_order orders;
  v_n     integer;
begin
  --------------------------------------------------- 1. the signup grant
  v_n := card_punches(v_user);
  assert v_n = 2, format('a new card starts at 2, got %s', v_n);

  --------------------------------------------------- 2. pastry earns nothing
  v_order := create_order(
    '[{"menu_item_id":"77777777-7777-7777-7777-777777777777","quantity":3,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user);
  v_n := card_punches(v_user);
  assert v_n = 2, format('pastry must not punch, got %s', v_n);

  --------------------------------------------------- 3. drinks earn per unit
  v_order := create_order(
    '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":4,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user);
  v_n := card_punches(v_user);
  assert v_n = 6, format('4 drinks on top of the grant is 6, got %s', v_n);

  --------------------------------------------- 4. the grant applies once only
  assert (select count(*) from orders where user_id = v_user) = 2,
    'fixture should have exactly two orders';

  ------------------------------------------- 5. a cancelled order stops counting
  update orders set status = 'cancelled' where id = v_order.id;
  v_n := card_punches(v_user);
  assert v_n = 2, format('cancelling the drinks order returns to 2, got %s', v_n);
  update orders set status = 'pending' where id = v_order.id;

  ------------------------------------------------------------- 6. my_usual
  set local role authenticated;
  set local request.jwt.claims =
    '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
  assert (my_usual() ->> 'menu_item_id') = '66666666-6666-6666-6666-666666666666',
    'the usual is the most-ordered item by quantity';
  assert (my_card() ->> 'punches')::integer = 6, 'my_card must agree with card_punches';
  assert (my_card() ->> 'ready')::boolean = false, 'a card of 6 is not ready';
  reset role;

  raise notice 'card.test.sql punch counting passed';
end;
$$;

rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run through `execute_sql`.
Expected: FAIL with `column "earns_punch" of relation "menu_categories" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260819121000_card.sql
-- The card. Twelve cups, two of them already on it the day you sign up.
--
-- The balance is derived, never stored: orders and order_items already ARE the
-- ledger, and a punch count is a view of purchase history. That is what makes a
-- refund self-healing — cancel the order and its punches leave the sum, with no
-- compensating write anywhere.

-- Which categories earn a punch. Beans and pastry do not.
alter table menu_categories add column earns_punch boolean not null default false;
update menu_categories set earns_punch = true
 where slug in ('espresso-bar', 'filter-cold', 'tea-alternatives');

-- Snapshot, for the same reason item_name and base_price are snapshotted on
-- this table: re-categorising the menu must not rewrite an existing card.
alter table order_items add column earns_punch boolean not null default false;

create table card_redemptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  order_id      uuid not null unique references orders(id) on delete cascade,
  punches_spent smallint not null default 12,
  item_name     text not null,
  created_at    timestamptz not null default now()
);

create index card_redemptions_user_idx on card_redemptions (user_id, created_at desc);

alter table card_redemptions enable row level security;

-- Read own, and nothing else. There is deliberately no insert policy: only
-- create_order(), which is security definer, may write a redemption.
create policy "card redemptions read own" on card_redemptions
  for select using (auth.uid() = user_id);

-- ------------------------------------------------------------------ balance
-- ponytail: the free cup earns its own punch, because it is a real cup and
-- excluding one unit of a multi-unit line needs per-unit accounting that buys
-- nothing. Effective cost after the first card is 11 paid cups per free one.
-- If that ever matters, store redeemed units on card_redemptions and subtract.
create function card_punches(p_user uuid)
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
                      and o.status <> 'cancelled'
                      and oi.earns_punch), 0)
       - coalesce((select sum(cr.punches_spent)::integer
                     from card_redemptions cr
                    where cr.user_id = p_user), 0);
$$;

-- ---------------------------------------------------------------- my card
-- No user argument on purpose: one account must not be able to read another's
-- card by passing an id.
create function my_card()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null
      then jsonb_build_object('punches', 0, 'ready', false, 'redeemed_count', 0)
    else jsonb_build_object(
      'punches',        card_punches(auth.uid()),
      'ready',          card_punches(auth.uid()) >= 12,
      'redeemed_count', (select count(*) from card_redemptions where user_id = auth.uid())
    )
  end;
$$;

-- ---------------------------------------------------------------- my usual
-- Most-ordered item by summed quantity, carrying the modifier set from the most
-- recent order of it — so "order again" reproduces the drink, not just the item.
create function my_usual()
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
       and o.status <> 'cancelled'
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

revoke all on function card_punches(uuid) from public, anon, authenticated;
revoke all on function my_card() from public;
revoke all on function my_usual() from public;
grant execute on function my_card() to authenticated;
grant execute on function my_usual() to authenticated;
```

- [ ] **Step 4: Apply and re-run the test**

Apply with MCP `apply_migration`, name `card`.
Then run `supabase/tests/card.test.sql` through `execute_sql`.
Expected: `NOTICE: card.test.sql punch counting passed`.

Note: the test's step 3 asserts 6 punches, which requires `create_order` to set `order_items.earns_punch`. It does not yet — that is Task 3. Expect step 3 to fail here with `4 drinks on top of the grant is 6, got 2`. **This is the intended red state.** Comment out assertions 3, 5 and 6 with a `-- Task 3` marker, confirm 1, 2 and 4 pass, and commit. Task 3 restores them.

- [ ] **Step 5: Regenerate types**

MCP `generate_typescript_types` → `types/supabase.ts`. Verify `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260819121000_card.sql supabase/tests/card.test.sql types/supabase.ts
git commit -m "feat(db): derive punch balance from orders, add card_redemptions"
```

---

### Task 3: Earning and redeeming inside the order functions

**Files:**
- Create: `supabase/migrations/20260819122000_card_redeem.sql`
- Modify: `supabase/tests/card.test.sql` (restore the commented assertions, add redemption cases)
- Apply: hosted Supabase, via MCP `apply_migration`

**Interfaces:**
- Consumes: `card_punches(uuid)` from Task 2; existing `order_lines(jsonb, boolean)`, `quote_order(jsonb)`, `create_order(jsonb, text, text, text, uuid, text, text)`
- Produces: `order_lines(jsonb, boolean, uuid)`, `quote_order(jsonb, uuid)`, `create_order(jsonb, text, text, text, uuid, text, text, uuid)`. Each line in the returned JSON gains `earns_punch` (boolean) and `redeemed_units` (integer, 0 or 1).

- [ ] **Step 1: Extend the test with the redemption cases**

Restore assertions 3, 5 and 6 in `supabase/tests/card.test.sql`, then append this block before `raise notice`:

```sql
  ---------------------------------------------- 7. a card that is not full
  declare
    v_failed boolean := false;
  begin
    perform create_order(
      '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":1,"modifiers":[]}]'::jsonb,
      'C', null, 'counter', v_user, null, null,
      '66666666-6666-6666-6666-666666666666');
  exception when sqlstate 'P0001' then
    v_failed := true;
  end;
  -- Not an error: the spec's accepted loss. The order is placed, undiscounted,
  -- with no redemption row. Assert that, not a raise.
  assert not v_failed, 'a short card must not fail the order';
  assert (select count(*) from card_redemptions where user_id = v_user) = 0,
    'a short card must not write a redemption';

  ------------------------------------------------- 8. fill the card and redeem
  perform create_order(
    '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":10,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user);
  assert card_punches(v_user) >= 12,
    format('card should be full, got %s', card_punches(v_user));

  -- Quantity 3, one of them free: 4.20 * 3 - 4.20 = 8.40.
  v_order := create_order(
    '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":3,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user, null, null,
    '66666666-6666-6666-6666-666666666666');
  assert v_order.total = 8.40,
    format('one free unit off a line of 3 leaves 8.40, got %s', v_order.total);
  assert (select count(*) from card_redemptions where order_id = v_order.id) = 1,
    'a redemption row must be written';
  assert (select punches_spent from card_redemptions where order_id = v_order.id) = 12,
    'a redemption burns exactly 12';

  ------------------------------------------ 9. redeeming something not in the cart
  declare
    v_failed2 boolean := false;
  begin
    perform create_order(
      '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":1,"modifiers":[]}]'::jsonb,
      'C', null, 'counter', v_user, null, null,
      '77777777-7777-7777-7777-777777777777');
  exception when sqlstate 'P0001' then
    v_failed2 := true;
  end;
  assert v_failed2, 'redeeming an item that is not in the cart must raise';

  ----------------------------------------------- 10. redeeming a non-drink
  perform create_order(
    '[{"menu_item_id":"66666666-6666-6666-6666-666666666666","quantity":20,"modifiers":[]}]'::jsonb,
    'C', null, 'counter', v_user);
  declare
    v_failed3 boolean := false;
  begin
    perform create_order(
      '[{"menu_item_id":"77777777-7777-7777-7777-777777777777","quantity":1,"modifiers":[]}]'::jsonb,
      'C', null, 'counter', v_user, null, null,
      '77777777-7777-7777-7777-777777777777');
  exception when sqlstate 'P0001' then
    v_failed3 := true;
  end;
  assert v_failed3, 'a pastry cannot be the free drink';
```

- [ ] **Step 2: Run it to verify it fails**

Run through `execute_sql`.
Expected: FAIL with `function create_order(jsonb, unknown, unknown, unknown, uuid, unknown, unknown, unknown) does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260819122000_card_redeem.sql
-- Earning and burning, threaded through the functions that already own money.
--
-- The discount arithmetic goes in order_lines() and nowhere else. quote_order
-- prices the Stripe session and create_order writes the order; both call
-- order_lines, so putting it there is what stops the card being charged one
-- number and the order storing another.
--
-- create_order keeps the authorisation — the lock and the balance check —
-- because it is the only one of the two that writes.

-- Old signatures go first: adding a defaulted argument to an existing function
-- creates an overload, and an ambiguous call is worse than a missing one.
drop function create_order(jsonb, text, text, text, uuid, text, text);
drop function quote_order(jsonb);
drop function order_lines(jsonb, boolean);

create function order_lines(p_items jsonb, p_lock boolean, p_redeem_item_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line     jsonb;
  v_item     menu_items%rowtype;
  v_qty      integer;
  v_group    jsonb;
  v_selected jsonb;
  v_option   jsonb;
  v_offset   numeric(8,2);
  v_unit     numeric(8,2);
  v_resolved jsonb;
  v_lines    jsonb := '[]'::jsonb;
  v_earns    boolean;
  v_free     integer;
  v_redeemed boolean := false;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nothing on the pass in this order.' using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many lines on one order.' using errcode = 'P0001';
  end if;

  -- Ordered by menu_item_id on purpose: two concurrent transactions taking
  -- row locks in a different order deadlock. Sorting removes that entirely.
  for v_line in
    select value from jsonb_array_elements(p_items) as t(value)
    order by (value ->> 'menu_item_id')
  loop
    v_qty := (v_line ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Quantity out of range.' using errcode = 'P0001';
    end if;

    if p_lock then
      select * into v_item
        from menu_items
       where id = (v_line ->> 'menu_item_id')::uuid
         and is_active
       for update;
    else
      select * into v_item
        from menu_items
       where id = (v_line ->> 'menu_item_id')::uuid
         and is_active;
    end if;

    if not found then
      raise exception 'That item is no longer on the menu.' using errcode = 'P0001';
    end if;

    select mc.earns_punch into v_earns
      from menu_categories mc
     where mc.id = v_item.category_id;
    v_earns := coalesce(v_earns, false);

    if jsonb_array_length(coalesce(v_line -> 'modifiers', '[]'::jsonb))
       <> jsonb_array_length(v_item.modifiers) then
      raise exception '% — that selection is not on the menu.', v_item.name
        using errcode = 'P0001',
              detail  = json_build_object('menu_item_id', v_item.id)::text;
    end if;

    v_offset   := 0;
    v_resolved := '[]'::jsonb;

    for v_group in select value from jsonb_array_elements(v_item.modifiers) as t(value)
    loop
      select value into v_selected
        from jsonb_array_elements(coalesce(v_line -> 'modifiers', '[]'::jsonb)) as t(value)
       where value ->> 'group' = v_group ->> 'name';

      if v_selected is null then
        raise exception '% — choose a %.', v_item.name, lower(v_group ->> 'name')
          using errcode = 'P0001',
                detail  = json_build_object('menu_item_id', v_item.id)::text;
      end if;

      select value into v_option
        from jsonb_array_elements(v_group -> 'options') as t(value)
       where value ->> 'name' = v_selected ->> 'option';

      if v_option is null then
        raise exception '% — that option is not available.', v_item.name
          using errcode = 'P0001',
                detail  = json_build_object('menu_item_id', v_item.id)::text;
      end if;

      v_offset := v_offset + (v_option ->> 'priceOffset')::numeric;

      v_resolved := v_resolved || jsonb_build_array(jsonb_build_object(
        'group',       v_group ->> 'name',
        'option',      v_option ->> 'name',
        'priceOffset', (v_option ->> 'priceOffset')::numeric
      ));
    end loop;

    if v_item.daily_stock is not null and v_item.daily_stock < v_qty then
      if v_item.daily_stock = 0 then
        raise exception '% — gone for today.', v_item.name
          using errcode = 'P0001',
                detail  = json_build_object('menu_item_id', v_item.id)::text;
      else
        raise exception '% — only % left.', v_item.name, v_item.daily_stock
          using errcode = 'P0001',
                detail  = json_build_object('menu_item_id', v_item.id)::text;
      end if;
    end if;

    v_unit := v_item.base_price + v_offset;

    -- One unit free, never the whole line. A line of three cortados with the
    -- card redeemed against it is one free cup and two paid ones.
    v_free := 0;
    if p_redeem_item_id is not null and v_item.id = p_redeem_item_id then
      if not v_earns then
        raise exception '% — the card is for drinks.', v_item.name
          using errcode = 'P0001',
                detail  = json_build_object('menu_item_id', v_item.id)::text;
      end if;
      v_free     := 1;
      v_redeemed := true;
    end if;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'menu_item_id',       v_item.id,
      'item_name',          v_item.name,
      'base_price',         v_item.base_price,
      'quantity',           v_qty,
      'selected_modifiers', v_resolved,
      'earns_punch',        v_earns,
      'redeemed_units',     v_free,
      'line_total',         v_unit * (v_qty - v_free)
    ));
  end loop;

  if p_redeem_item_id is not null and not v_redeemed then
    raise exception 'That drink is not in this order.' using errcode = 'P0001';
  end if;

  return v_lines;
end;
$$;

-- -------------------------------------------------------------------- quote
-- The card is checked HERE as well as in create_order. quote_order is granted
-- to authenticated, so without this a customer could name a redeem item with an
-- empty card and be sent to Stripe with a discounted session.
create function quote_order(p_items jsonb, p_redeem_item_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lines jsonb;
begin
  if p_redeem_item_id is not null then
    if auth.uid() is null or card_punches(auth.uid()) < 12 then
      raise exception 'Your card is not full yet.' using errcode = 'P0001';
    end if;
  end if;

  v_lines := order_lines(p_items, false, p_redeem_item_id);

  return jsonb_build_object(
    'lines',    v_lines,
    'subtotal', coalesce((select sum((l ->> 'line_total')::numeric)
                            from jsonb_array_elements(v_lines) as t(l)), 0)
  );
end;
$$;

-- ------------------------------------------------------------- create_order
create function create_order(
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
  v_order    orders;
  v_lines    jsonb;
  v_subtotal numeric(8,2);
  v_user     uuid;
  v_redeem   uuid := null;
  v_free     jsonb;
begin
  if p_payment_method not in ('online', 'counter') then
    raise exception 'Unknown payment method.' using errcode = 'P0001';
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

  -- The burn. The advisory lock serializes this user's redemptions and releases
  -- with the transaction; create_order is already the serialization point for
  -- stock, so nothing new is being held open.
  if p_redeem_item_id is not null then
    if v_user is null then
      raise exception 'The card belongs to an account.' using errcode = 'P0001';
    end if;

    perform pg_advisory_xact_lock(hashtext(v_user::text));

    if card_punches(v_user) >= 12 then
      v_redeem := p_redeem_item_id;
    else
      -- ponytail: accepted loss. Two concurrent checkouts on one full card both
      -- reach here; the second finds it spent. We are holding their money, and
      -- refunding a whole paid order over one drink is worse than absorbing it,
      -- so the order stands at full price with no redemption row.
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

  insert into orders (user_id, status, customer_name, notes, subtotal, total,
                      payment_method, pickup_at, stripe_session_id,
                      stripe_payment_intent_id)
  values (v_user,
          case when p_payment_method = 'online' then 'paid' else 'pending' end::order_status,
          nullif(btrim(left(coalesce(p_customer_name, ''), 80)), ''),
          nullif(btrim(left(coalesce(p_notes, ''), 280)), ''),
          v_subtotal,
          v_subtotal,
          p_payment_method,
          now() + interval '10 minutes',
          p_stripe_session_id,
          p_stripe_payment_intent_id)
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
    select value into v_free
      from jsonb_array_elements(v_lines) as t(value)
     where (value ->> 'menu_item_id')::uuid = v_redeem;

    insert into card_redemptions (user_id, order_id, item_name)
    values (v_user, v_order.id, v_free ->> 'item_name');
  end if;

  return v_order;
end;
$$;

revoke all on function order_lines(jsonb, boolean, uuid) from public, anon, authenticated;
revoke all on function quote_order(jsonb, uuid) from public;
revoke all on function create_order(jsonb, text, text, text, uuid, text, text, uuid) from public;
grant execute on function quote_order(jsonb, uuid) to anon, authenticated;
grant execute on function create_order(jsonb, text, text, text, uuid, text, text, uuid)
  to anon, authenticated, service_role;
```

- [ ] **Step 4: Apply and re-run both SQL tests**

Apply with MCP `apply_migration`, name `card_redeem`.
Run `supabase/tests/card.test.sql` — expected `NOTICE: card.test.sql punch counting passed`.
Run `supabase/tests/create_order.test.sql` — expected its existing notice. It calls `create_order` with four arguments, which still resolves against the new defaults. If it fails, the regression is real; fix it before committing.

- [ ] **Step 5: Regenerate types**

MCP `generate_typescript_types` → `types/supabase.ts`. Verify `npx tsc --noEmit`.

At this point `app/checkout/actions.ts` and `lib/payment.ts` still call the RPCs without the new argument. That compiles and runs — the argument is defaulted. Task 11 wires it.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260819122000_card_redeem.sql supabase/tests/card.test.sql types/supabase.ts
git commit -m "feat(db): earn punches on drinks, redeem one free unit in order_lines"
```

---

### Task 4: Shared order-status labels

**Files:**
- Create: `lib/order-status.ts`
- Create: `lib/order-status.test.ts`
- Modify: `components/checkout/OrderStatus.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `type OrderStatus`, `ORDER_STATUSES: OrderStatus[]`, `ORDER_STATUS_LABELS: Record<OrderStatus, { text: string; tone: string }>`, `isSettled(status): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// node --test lib/order-status.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { ORDER_STATUSES, ORDER_STATUS_LABELS, isSettled } from "./order-status.ts";

test("every status has a label and a tone class", () => {
  for (const status of ORDER_STATUSES) {
    const label = ORDER_STATUS_LABELS[status];
    assert.ok(label, `no label for ${status}`);
    assert.ok(label.text.length > 0, `empty text for ${status}`);
    assert.match(label.tone, /^text-/, `tone for ${status} is not a text- class`);
  }
});

test("the label map has no entries beyond the enum", () => {
  assert.deepEqual(
    Object.keys(ORDER_STATUS_LABELS).sort(),
    [...ORDER_STATUSES].sort(),
  );
});

test("only collected and cancelled are settled", () => {
  assert.equal(isSettled("collected"), true);
  assert.equal(isSettled("cancelled"), true);
  assert.equal(isSettled("paid"), false);
  assert.equal(isSettled("preparing"), false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test lib/order-status.test.ts`
Expected: FAIL, cannot find module `./order-status.ts`.

- [ ] **Step 3: Write the module**

```ts
// lib/order-status.ts
/**
 * One source of truth for how an order's state is worded. Both the guest
 * confirmation page and the account order list read it, so the bar and the
 * customer never see two different words for the same thing.
 */
export const ORDER_STATUSES = [
  "pending",
  "paid",
  "preparing",
  "ready",
  "collected",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, { text: string; tone: string }> = {
  pending: { text: "On the pass", tone: "text-accent-primary" },
  paid: { text: "Paid — on the pass", tone: "text-badge-live" },
  preparing: { text: "Brewing now", tone: "text-badge-live" },
  ready: { text: "Ready at the bar", tone: "text-badge-live" },
  collected: { text: "Collected", tone: "text-text-tertiary" },
  cancelled: { text: "Cancelled", tone: "text-badge-alert" },
};

/** Settled orders stop polling — nothing more will happen to them. */
export function isSettled(status: OrderStatus): boolean {
  return status === "collected" || status === "cancelled";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/order-status.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Point `OrderStatus.tsx` at the shared module**

In `components/checkout/OrderStatus.tsx`: delete the local `SETTLED` array and the local `LABELS` object, add the import, and replace the two usages.

```tsx
import { ORDER_STATUS_LABELS, isSettled, type OrderStatus } from "@/lib/order-status";
```

`OrderDoc["status"]` becomes `OrderStatus`. The polling guard becomes:

```tsx
if (isSettled(order.status)) return;
```

and the label lookup becomes:

```tsx
const label = ORDER_STATUS_LABELS[order.status];
```

- [ ] **Step 6: Verify nothing regressed**

Run: `pnpm lint && npx tsc --noEmit`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add lib/order-status.ts lib/order-status.test.ts components/checkout/OrderStatus.tsx
git commit -m "refactor: extract order status labels into lib/order-status"
```

---

### Task 5: Account shell — layout and navigation

**Files:**
- Create: `app/account/layout.tsx`
- Create: `components/account/AccountNav.tsx`
- Modify: `app/account/page.tsx` (strip the header it currently renders inline)

**Interfaces:**
- Consumes: `my_card()` from Task 2, `createClient` from `lib/server.ts`, `spring` from `lib/motion.ts`
- Produces: `type AccountNavItem = { href: string; label: string; badge?: string }`; the layout fetches `user`, `profile` and `card` once and every child page re-reads them from its own query only when it needs more

- [ ] **Step 1: Write the nav component**

```tsx
// components/account/AccountNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type AccountNavItem = { href: string; label: string; badge?: string };

/**
 * A hairline rail on desktop, the CategoryNav pill rail below md. Both drive the
 * same active state off the pathname, so there is nothing to keep in sync.
 */
export function AccountNav({ items }: { items: AccountNavItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/account" ? pathname === "/account" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop rail */}
      <nav aria-label="Account" className="hidden md:block">
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex items-baseline justify-between gap-4 py-3 font-mono text-[11px]",
                  "font-medium tracking-[0.16em] uppercase transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                  isActive(item.href)
                    ? "text-text-primary"
                    : "text-text-tertiary hover:text-text-primary",
                )}
              >
                {item.label}
                {item.badge && (
                  <span className="font-mono text-[11px] tracking-[0.02em] tabular-nums text-text-tertiary">
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile pills */}
      <nav
        aria-label="Account"
        className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 md:hidden"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "relative flex h-9 shrink-0 items-center rounded-full px-4 font-mono text-[10px]",
              "font-medium tracking-[0.16em] uppercase transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
              isActive(item.href) ? "text-surface-canvas" : "text-text-tertiary",
            )}
          >
            {isActive(item.href) && (
              <motion.span
                layoutId="activeAccountNav"
                transition={spring}
                aria-hidden
                className="absolute inset-0 rounded-full bg-text-primary"
              />
            )}
            <span className="relative">
              {item.label}
              {item.badge && ` ${item.badge}`}
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
```

- [ ] **Step 2: Write the layout**

```tsx
// app/account/layout.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/AuthForm";
import { AccountNav, type AccountNavItem } from "@/components/account/AccountNav";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { createClient } from "@/lib/server";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already redirects, this is the belt to its braces.
  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: card }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.rpc("my_card"),
  ]);

  const punches = (card as { punches?: number } | null)?.punches ?? 0;

  const items: AccountNavItem[] = [
    { href: "/account", label: "Overview" },
    { href: "/account/orders", label: "Orders" },
    { href: "/account/card", label: "Card", badge: `${punches}/12` },
    { href: "/account/settings", label: "Settings" },
  ];

  const name = profile?.display_name?.trim() || user.email?.split("@")[0] || "You";

  return (
    <>
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-hairline bg-surface-canvas/85 px-5 backdrop-blur-xl sm:px-10 lg:px-14">
        <Link
          href="/"
          className="font-serif text-[26px] leading-none tracking-[-0.02em] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus"
        >
          KROMA
        </Link>
        <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
          Account
        </span>
      </header>

      <main className="flex-1 px-5 pt-24 pb-24 sm:px-10 lg:px-14 lg:pt-32 lg:pb-32">
        <div className="grid gap-10 md:grid-cols-[200px_minmax(0,1fr)] md:gap-0">
          <div className="md:sticky md:top-24 md:self-start md:pr-10">
            <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
              {name}
            </p>
            <div className="mt-6 border-y border-hairline py-2 md:border-b-0">
              <AccountNav items={items} />
            </div>
            <div className="mt-6 hidden md:block">
              <SignOutButton />
            </div>
          </div>

          <div className="md:border-l md:border-hairline md:pl-10 lg:pl-14">{children}</div>
        </div>

        <div className="mt-16 md:hidden">
          <SignOutButton />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 3: Strip the duplicated chrome from the Overview page**

In `app/account/page.tsx`, delete the `<header>` element, the `<SiteFooter />`, the `<main>` wrapper and the now-unused imports (`Link`, `SignOutButton`, `SiteFooter`). Keep the rest for now — Task 6 rewrites the body. Leave the `redirect` guard: it is cheap and the page reads `user` itself.

- [ ] **Step 4: Check it renders**

Run: `pnpm dev`, sign in, open `/account`.
Expected: one header, the rail on the left at `md` and up, pills below `md`, no duplicated footer. The CARD entry reads `CARD 2/12` for a new account.

- [ ] **Step 5: Verify**

Run: `pnpm lint && npx tsc --noEmit`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add app/account/layout.tsx components/account/AccountNav.tsx app/account/page.tsx
git commit -m "feat(account): add dashboard shell with hairline rail and mobile pills"
```

---

### Task 6: Overview page and the punch card component

**Files:**
- Create: `components/account/PunchCard.tsx`
- Create: `components/account/ReorderButton.tsx`
- Rewrite: `app/account/page.tsx`

**Interfaces:**
- Consumes: `my_card()`, `my_usual()` from Task 2; `ORDER_STATUS_LABELS` from Task 4; `useCart` from `lib/use-cart.ts`; `CartLine` from `lib/cart.ts`
- Produces: `<PunchCard punches={number} size?={"sm" | "lg"} />`, `<ReorderButton lines={CartLine[]} unavailable?={string[]} label?={string} />`

- [ ] **Step 1: Write the punch card component**

```tsx
// components/account/PunchCard.tsx
const CARD_LENGTH = 12;

/**
 * Twelve glyphs on a row. Deliberately not a progress bar: the whole point of a
 * card is that you can count what is left at a glance.
 */
export function PunchCard({
  punches,
  size = "sm",
}: {
  punches: number;
  size?: "sm" | "lg";
}) {
  const filled = Math.max(0, Math.min(punches, CARD_LENGTH));
  const left = CARD_LENGTH - filled;

  return (
    <div>
      <p
        aria-hidden
        className={
          size === "lg"
            ? "flex gap-3 text-[28px] leading-none text-text-primary"
            : "flex gap-2 text-[15px] leading-none text-text-primary"
        }
      >
        {Array.from({ length: CARD_LENGTH }, (_, i) => (
          <span key={i} className={i < filled ? "text-text-primary" : "text-hairline"}>
            {i < filled ? "●" : "○"}
          </span>
        ))}
      </p>

      <p
        role="status"
        className="mt-4 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-secondary"
      >
        {left === 0 ? (
          <span className="text-accent-primary">
            Card full — one drink on us, pick it at checkout
          </span>
        ) : (
          <>
            {filled} {filled === 1 ? "cup" : "cups"} in
            <span aria-hidden className="mx-3 text-hairline">
              /
            </span>
            {left} to go
          </>
        )}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Write the reorder button**

```tsx
// components/account/ReorderButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

import { pressSpring } from "@/lib/motion";
import { useCart } from "@/lib/use-cart";
import type { CartLine } from "@/lib/cart";

/**
 * Pushes past lines back into the live cart and sends the customer to checkout.
 * Lines whose item is gone for today are dropped, and said so plainly — the
 * alternative is a checkout that raises on a line the customer never chose.
 */
export function ReorderButton({
  lines,
  unavailable = [],
  label = "Order again",
}: {
  lines: CartLine[];
  unavailable?: string[];
  label?: string;
}) {
  const router = useRouter();
  const { add, ready } = useCart(true);
  const [busy, setBusy] = useState(false);

  if (lines.length === 0) {
    return (
      <p className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-badge-alert">
        Gone for today
      </p>
    );
  }

  return (
    <div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        transition={pressSpring}
        disabled={!ready || busy}
        onClick={() => {
          setBusy(true);
          for (const line of lines) add(line);
          router.push("/checkout");
        }}
        className="flex h-10 items-center rounded-full bg-accent-primary px-5 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-surface-card transition-colors hover:bg-accent-hover disabled:bg-surface-muted disabled:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      >
        {label}
      </motion.button>

      {unavailable.length > 0 && (
        <p className="mt-3 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-badge-alert">
          {unavailable.length === 1
            ? "One line is gone for today"
            : `${unavailable.length} lines are gone for today`}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the Overview page**

```tsx
// app/account/page.tsx
import Link from "next/link";

import { PunchCard } from "@/components/account/PunchCard";
import { ReorderButton } from "@/components/account/ReorderButton";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { createClient } from "@/lib/server";
import type { CartLine } from "@/lib/cart";

type Usual = {
  menu_item_id: string;
  name: string;
  base_price: number;
  daily_stock: number | null;
  image_url: string | null;
  times_ordered: number;
  selected_modifiers: { group: string; option: string; priceOffset: number }[];
};

/** Opening hours are 07:30; anything before noon is still morning at the bar. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}

export default async function AccountOverviewPage() {
  const supabase = await createClient();

  const [{ data: card }, { data: usualRaw }, { data: orders }] = await Promise.all([
    supabase.rpc("my_card"),
    supabase.rpc("my_usual"),
    supabase
      .from("orders")
      .select("id, order_number, status, total, placed_at")
      .order("placed_at", { ascending: false })
      .limit(1),
  ]);

  const punches = (card as { punches?: number } | null)?.punches ?? 0;
  const usual = usualRaw as unknown as Usual | null;
  const last = orders?.[0];

  const usualLine: CartLine[] =
    usual && usual.daily_stock !== 0
      ? [
          {
            id: `usual-${usual.menu_item_id}`,
            menuItemId: usual.menu_item_id,
            name: usual.name,
            basePrice: Number(usual.base_price),
            quantity: 1,
            selectedModifiers: usual.selected_modifiers,
            imageUrl: usual.image_url ?? "",
          },
        ]
      : [];

  return (
    <>
      <h1 className="max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
        {greeting()}
      </h1>

      {/* The card */}
      <section aria-label="Your card" className="mt-12 border-y border-hairline py-8">
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
          Your card
        </p>
        <div className="mt-6">
          <PunchCard punches={punches} />
        </div>
        <Link
          href="/account/card"
          className="mt-6 inline-block font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          How the card works
        </Link>
      </section>

      {/* Your usual */}
      <section aria-label="Your usual" className="border-b border-hairline py-8">
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
          Your usual
        </p>

        {!usual ? (
          <p className="mt-6 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
            Nothing ordered twice yet.
          </p>
        ) : (
          <>
            <p className="mt-4 font-serif text-[clamp(24px,2.6vw,34px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
              {usual.name}
            </p>
            <p className="mt-3 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-tertiary">
              {usual.selected_modifiers.map((m) => m.option).join(" / ") || "As it comes"}
              <span aria-hidden className="mx-3 text-hairline">
                /
              </span>
              Ordered {usual.times_ordered}×
            </p>
            <div className="mt-6">
              <ReorderButton lines={usualLine} label="Order again" />
            </div>
          </>
        )}
      </section>

      {/* Last order */}
      <section aria-label="Last order" className="border-b border-hairline py-8">
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
          Last order
        </p>

        {!last ? (
          <p className="mt-6 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
            No orders under your name yet.
          </p>
        ) : (
          <Link
            href={`/account/orders/${last.id}`}
            className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus"
          >
            <span className="font-mono text-[13px] tracking-[0.02em] tabular-nums text-text-primary">
              #{String(last.order_number).padStart(3, "0")}
            </span>
            <span
              className={`font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${
                ORDER_STATUS_LABELS[last.status as OrderStatus].tone
              }`}
            >
              {ORDER_STATUS_LABELS[last.status as OrderStatus].text}
            </span>
            <span className="font-mono text-[13px] tracking-[0.02em] tabular-nums text-text-primary">
              €{Number(last.total).toFixed(2)}
            </span>
          </Link>
        )}
      </section>
    </>
  );
}
```

- [ ] **Step 4: Check it renders**

Run `pnpm dev`, open `/account`.
Expected: greeting, twelve glyphs reading `2 CUPS IN / 10 TO GO` on a fresh account, `Nothing ordered twice yet.` until an order exists, last order row linking to a 404 until Task 8.

- [ ] **Step 5: Verify**

Run: `pnpm lint && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/account/PunchCard.tsx components/account/ReorderButton.tsx app/account/page.tsx
git commit -m "feat(account): overview with punch card, your usual and last order"
```

---

### Task 7: Orders history

**Files:**
- Create: `app/account/orders/page.tsx`

**Interfaces:**
- Consumes: `ORDER_STATUS_LABELS` from Task 4
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the page**

```tsx
// app/account/orders/page.tsx
import Link from "next/link";

import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { createClient } from "@/lib/server";

const PER_PAGE = 20;

function day(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: raw } = await searchParams;
  const page = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
  const from = (page - 1) * PER_PAGE;

  const supabase = await createClient();

  // No .eq("user_id", …) on purpose: the "orders read own" policy scopes this,
  // and leaning on the policy is what proves the policy works.
  const { data: orders, count } = await supabase
    .from("orders")
    .select("id, order_number, status, total, placed_at, order_items(quantity)", {
      count: "exact",
    })
    .order("placed_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <h1 className="font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
        Orders.
      </h1>

      {!orders || orders.length === 0 ? (
        <p className="mt-12 border-y border-hairline py-10 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
          No orders under your name yet.
        </p>
      ) : (
        <ul className="mt-12 divide-y divide-hairline border-y border-hairline">
          {orders.map((order) => {
            const items = (order.order_items as { quantity: number }[] | null) ?? [];
            const cups = items.reduce((sum, item) => sum + item.quantity, 0);
            const label = ORDER_STATUS_LABELS[order.status as OrderStatus];

            return (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-7 transition-colors hover:bg-surface-muted/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus sm:py-9"
                >
                  <span className="font-mono text-[13px] tracking-[0.02em] tabular-nums text-text-primary">
                    #{String(order.order_number).padStart(3, "0")}
                  </span>
                  <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-tertiary">
                    {day(order.placed_at)}
                    <span aria-hidden className="mx-3 text-hairline">
                      /
                    </span>
                    {cups} {cups === 1 ? "item" : "items"}
                  </span>
                  <span
                    className={`font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${label.tone}`}
                  >
                    {label.text}
                  </span>
                  <span className="font-mono text-[13px] tracking-[0.02em] tabular-nums text-text-primary">
                    €{Number(order.total).toFixed(2)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {lastPage > 1 && (
        <nav
          aria-label="Order history pages"
          className="mt-10 flex items-center justify-between font-mono text-[11px] font-medium tracking-[0.14em] uppercase"
        >
          {page > 1 ? (
            <Link
              href={`/account/orders?page=${page - 1}`}
              className="text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              Newer
            </Link>
          ) : (
            <span className="text-hairline">Newer</span>
          )}

          <span className="text-text-tertiary tabular-nums">
            {page} / {lastPage}
          </span>

          {page < lastPage ? (
            <Link
              href={`/account/orders?page=${page + 1}`}
              className="text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              Older
            </Link>
          ) : (
            <span className="text-hairline">Older</span>
          )}
        </nav>
      )}
    </>
  );
}
```

- [ ] **Step 2: Check it renders and paginates**

Run `pnpm dev`, open `/account/orders`.
Expected: hairline-divided rows; with fewer than 21 orders no pager appears. Place 21 counter orders (or insert rows through `execute_sql` inside a transaction you commit on a throwaway account) and confirm `?page=2` shows the remainder.

- [ ] **Step 3: Verify**

Run: `pnpm lint && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/account/orders/page.tsx
git commit -m "feat(account): paginated order history"
```

---

### Task 8: Order detail

**Files:**
- Create: `app/account/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `ORDER_STATUS_LABELS` from Task 4, `ReorderButton` from Task 6
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the page**

```tsx
// app/account/orders/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReorderButton } from "@/components/account/ReorderButton";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { createClient } from "@/lib/server";
import type { CartLine } from "@/lib/cart";

type Modifier = { group: string; option: string; priceOffset: number };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // The "orders read own" policy scopes this. Someone else's id returns nothing,
  // which is a 404 — the same answer as an id that does not exist, so the page
  // does not confirm that another customer's order is real.
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, subtotal, total, placed_at, payment_method, notes, customer_name, order_items(id, menu_item_id, item_name, base_price, quantity, selected_modifiers, line_total)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const items =
    (order.order_items as {
      id: string;
      menu_item_id: string | null;
      item_name: string;
      base_price: number;
      quantity: number;
      selected_modifiers: Modifier[];
      line_total: number;
    }[]) ?? [];

  const label = ORDER_STATUS_LABELS[order.status as OrderStatus];

  // Only lines whose menu item still exists and is in stock can go back in the
  // cart. Everything else is named as gone rather than silently dropped.
  const orderable = items.filter((item) => item.menu_item_id !== null);
  const { data: stock } = await supabase
    .from("menu_items")
    .select("id, daily_stock, image_url")
    .in("id", orderable.map((item) => item.menu_item_id as string));

  const stockById = new Map((stock ?? []).map((row) => [row.id, row]));

  const lines: CartLine[] = [];
  const unavailable: string[] = [];

  for (const item of items) {
    const row = item.menu_item_id ? stockById.get(item.menu_item_id) : undefined;
    if (!row || row.daily_stock === 0) {
      unavailable.push(item.item_name);
      continue;
    }
    lines.push({
      id: `reorder-${item.id}`,
      menuItemId: item.menu_item_id as string,
      name: item.item_name,
      basePrice: Number(item.base_price),
      quantity: item.quantity,
      selectedModifiers: item.selected_modifiers,
      imageUrl: row.image_url ?? "",
    });
  }

  return (
    <>
      <Link
        href="/account/orders"
        className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      >
        ← Orders
      </Link>

      <h1 className="mt-5 font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary tabular-nums">
        #{String(order.order_number).padStart(3, "0")}
      </h1>

      <p
        className={`mt-4 font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${label.tone}`}
      >
        {label.text}
        <span aria-hidden className="mx-3 text-hairline">
          /
        </span>
        <span className="text-text-tertiary">
          {new Date(order.placed_at).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span aria-hidden className="mx-3 text-hairline">
          /
        </span>
        <span className="text-text-tertiary">
          {order.payment_method === "online" ? "Paid by card" : "Pay at the bar"}
        </span>
      </p>

      <ul className="mt-12 divide-y divide-hairline border-y border-hairline">
        {items.map((item) => (
          <li key={item.id} className="py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <span className="font-serif text-[clamp(20px,2.2vw,28px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
                {item.quantity > 1 && (
                  <span className="font-mono text-[13px] tabular-nums">{item.quantity}× </span>
                )}
                {item.item_name}
              </span>
              <span className="font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums text-text-primary">
                €{Number(item.line_total).toFixed(2)}
              </span>
            </div>

            {item.selected_modifiers.length > 0 && (
              <p className="mt-2.5 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-tertiary">
                {item.selected_modifiers.map((modifier, index) => (
                  <span key={modifier.group}>
                    {index > 0 && (
                      <span aria-hidden className="mx-3 text-hairline">
                        /
                      </span>
                    )}
                    {modifier.option}
                  </span>
                ))}
              </p>
            )}

            {Number(item.line_total) < Number(item.base_price) * item.quantity && (
              <p className="mt-2.5 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-accent-primary">
                One on us
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase text-text-tertiary">
          Total
        </span>
        <span className="font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums text-text-primary">
          €{Number(order.total).toFixed(2)}
        </span>
      </div>

      {order.notes && (
        <p className="mt-10 max-w-lg text-[15px] leading-[1.55] text-text-secondary">
          {order.notes}
        </p>
      )}

      <div className="mt-10">
        <ReorderButton lines={lines} unavailable={unavailable} />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Check it renders and is scoped**

Run `pnpm dev`. Open a real order from `/account/orders` — expect the full breakdown.
Then take an order id belonging to a different account (query one through `execute_sql`) and open `/account/orders/<that id>`.
Expected: 404, not the order.

- [ ] **Step 3: Verify**

Run: `pnpm lint && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add "app/account/orders/[id]/page.tsx"
git commit -m "feat(account): order detail with line breakdown and reorder"
```

---

### Task 9: The card page

**Files:**
- Create: `app/account/card/page.tsx`

**Interfaces:**
- Consumes: `PunchCard` from Task 6, `card_redemptions` from Task 2
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the page**

```tsx
// app/account/card/page.tsx
import { PunchCard } from "@/components/account/PunchCard";
import { createClient } from "@/lib/server";

function day(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function CardPage() {
  const supabase = await createClient();

  const [{ data: card }, { data: redemptions }] = await Promise.all([
    supabase.rpc("my_card"),
    supabase
      .from("card_redemptions")
      .select("id, item_name, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const punches = (card as { punches?: number } | null)?.punches ?? 0;

  return (
    <>
      <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
        Your card
      </p>

      <h1 className="mt-5 max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
        Twelve cups.
      </h1>

      <div className="mt-12 border-y border-hairline py-10">
        <PunchCard punches={punches} size="lg" />
      </div>

      <p className="mt-10 max-w-md text-[16px] leading-[1.6] text-text-secondary">
        Every coffee, filter or tea adds a cup to the card. Pastry and beans do
        not. At twelve, the next drink is on us — pick it at checkout. The card
        starts with two cups already on it, and it never expires.
      </p>

      <h2 className="mt-16 font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
        On us so far
      </h2>

      {!redemptions || redemptions.length === 0 ? (
        <p className="mt-6 border-y border-hairline py-10 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
          No cards filled yet.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
          {redemptions.map((redemption) => (
            <li
              key={redemption.id}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5"
            >
              <span className="font-mono text-[13px] tracking-[0.02em] text-text-primary">
                {redemption.item_name}
              </span>
              <span className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase text-text-tertiary">
                {day(redemption.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 2: Check it renders**

Run `pnpm dev`, open `/account/card`.
Expected: twelve large glyphs, `2 CUPS IN / 10 TO GO`, the explanation, and `No cards filled yet.`

- [ ] **Step 3: Verify**

Run: `pnpm lint && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/account/card/page.tsx
git commit -m "feat(account): card page with punch strip and redemption history"
```

---

### Task 10: Settings and account actions

**Files:**
- Create: `app/account/actions.ts`
- Create: `app/account/settings/page.tsx`
- Create: `components/account/SettingsForms.tsx`

**Interfaces:**
- Consumes: `profiles` from Task 1, `admin()` from `lib/admin.ts`
- Produces: server actions `saveProfile(formData): Promise<{ ok: boolean; message?: string }>`, `savePreferences(formData): Promise<{ ok: boolean; message?: string }>`, `deleteAccount(formData): Promise<{ ok: false; message: string } | never>`

- [ ] **Step 1: Write the server actions**

```ts
// app/account/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { admin } from "@/lib/admin";
import { createClient } from "@/lib/server";

export type ActionResult = { ok: boolean; message?: string };

/** Only tags the menu actually uses. Anything else is dropped, not rejected. */
const DIETARY = ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free"];

export async function saveProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  // Trust boundary. RLS scopes the write to this row; this pass keeps junk out.
  const name = String(formData.get("display_name") ?? "").trim().slice(0, 80);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 32);

  if (phone && !/^[+0-9 ()-]{6,32}$/.test(phone)) {
    return { ok: false, message: "That phone number does not look right." };
  }

  const tags = formData
    .getAll("dietary_tags")
    .map((tag) => String(tag))
    .filter((tag) => DIETARY.includes(tag));

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: name || null,
    phone: phone || null,
    dietary_tags: tags,
  });

  if (error) {
    console.error("profile save failed:", error.message);
    return { ok: false, message: "That did not save. Try again." };
  }

  revalidatePath("/account", "layout");
  return { ok: true, message: "Saved." };
}

export async function savePreferences(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    marketing_opt_in: formData.get("marketing_opt_in") === "on",
  });

  if (error) {
    console.error("preferences save failed:", error.message);
    return { ok: false, message: "That did not save. Try again." };
  }

  revalidatePath("/account/settings");
  return { ok: true, message: "Saved." };
}

/**
 * Deletes the account for good. profiles, carts and favourites cascade;
 * orders.user_id is `on delete set null`, so the bakehouse keeps its records
 * and the customer is anonymised out of them.
 *
 * The service role is required — a user cannot delete themselves from auth via
 * the anon key. This is its only use outside the Stripe webhook and the cron.
 */
export async function deleteAccount(formData: FormData): Promise<ActionResult> {
  if (String(formData.get("confirm")) !== "DELETE") {
    return { ok: false, message: "Type DELETE to confirm." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const { error } = await admin().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("account delete failed:", error.message);
    return { ok: false, message: "The account could not be deleted." };
  }

  await supabase.auth.signOut();
  redirect("/");
}
```

- [ ] **Step 2: Write the client forms**

```tsx
// components/account/SettingsForms.tsx
"use client";

import { useActionState } from "react";
import { motion } from "framer-motion";

import { pressSpring } from "@/lib/motion";
import type { ActionResult } from "@/app/account/actions";

const DIETARY = ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free"];

const FIELD =
  "h-10 w-full max-w-sm rounded-md border border-border-subtle bg-surface-card px-3 font-mono text-[13px] tracking-[0.02em] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

const LABEL =
  "font-mono text-[10px] font-medium tracking-[0.18em] uppercase text-text-tertiary";

const SUBMIT =
  "flex h-10 items-center rounded-full bg-accent-primary px-5 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-surface-card transition-colors hover:bg-accent-hover disabled:bg-surface-muted disabled:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

function Result({ state }: { state: ActionResult | null }) {
  if (!state?.message) return null;
  return (
    <p
      role="status"
      className={`mt-4 font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${
        state.ok ? "text-badge-live" : "text-badge-alert"
      }`}
    >
      {state.message}
    </p>
  );
}

export function ProfileForm({
  action,
  displayName,
  phone,
  dietaryTags,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  displayName: string;
  phone: string;
  dietaryTags: string[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => action(formData),
    null,
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-6">
      <div>
        <label className={LABEL} htmlFor="display_name">
          Name at the bar
        </label>
        <input
          id="display_name"
          name="display_name"
          defaultValue={displayName}
          maxLength={80}
          className={`${FIELD} mt-2`}
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="phone">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone}
          maxLength={32}
          className={`${FIELD} mt-2`}
        />
      </div>

      <fieldset>
        <legend className={LABEL}>Diet</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {DIETARY.map((tag) => (
            <label
              key={tag}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-surface-muted px-4 font-mono text-[10px] font-medium tracking-[0.16em] uppercase text-text-primary has-[:checked]:bg-text-primary has-[:checked]:text-surface-canvas"
            >
              <input
                type="checkbox"
                name="dietary_tags"
                value={tag}
                defaultChecked={dietaryTags.includes(tag)}
                className="sr-only"
              />
              {tag}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <motion.button
          type="submit"
          disabled={pending}
          whileTap={{ scale: 0.98 }}
          transition={pressSpring}
          className={SUBMIT}
        >
          Save
        </motion.button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function PreferencesForm({
  action,
  marketingOptIn,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  marketingOptIn: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => action(formData),
    null,
  );

  return (
    <form action={formAction} className="mt-6">
      <label className="flex cursor-pointer items-center justify-between gap-6 border-y border-hairline py-5">
        <span className={LABEL}>Seasonal notes</span>
        <input
          type="checkbox"
          name="marketing_opt_in"
          defaultChecked={marketingOptIn}
          className="size-4 accent-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        />
      </label>

      <div className="mt-6">
        <motion.button
          type="submit"
          disabled={pending}
          whileTap={{ scale: 0.98 }}
          transition={pressSpring}
          className={SUBMIT}
        >
          Save
        </motion.button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function DeleteAccountForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => action(formData),
    null,
  );

  return (
    <form action={formAction} className="mt-6">
      <p className="max-w-md text-[15px] leading-[1.55] text-text-secondary">
        This removes your account, your card and your saved items. Past orders
        stay on the bakehouse&rsquo;s books without your name on them. It cannot
        be undone.
      </p>

      <label className={`${LABEL} mt-6 block`} htmlFor="confirm">
        Type DELETE to confirm
      </label>
      <input id="confirm" name="confirm" autoComplete="off" className={`${FIELD} mt-2`} />

      <div className="mt-6">
        <motion.button
          type="submit"
          disabled={pending}
          whileTap={{ scale: 0.98 }}
          transition={pressSpring}
          className="flex h-10 items-center rounded-full border border-badge-alert px-5 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-badge-alert transition-colors hover:bg-badge-alert hover:text-surface-card disabled:border-border-subtle disabled:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          Delete account
        </motion.button>
        <Result state={state} />
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Write the settings page**

```tsx
// app/account/settings/page.tsx
import Link from "next/link";

import {
  DeleteAccountForm,
  PreferencesForm,
  ProfileForm,
} from "@/components/account/SettingsForms";
import { createClient } from "@/lib/server";
import { deleteAccount, savePreferences, saveProfile } from "../actions";

const PROVIDER_LABELS: Record<string, string> = {
  email: "Email and password",
  google: "Google",
  facebook: "Facebook",
};

const SECTION = "border-b border-hairline py-10";
const HEADING =
  "font-mono text-[10px] font-medium tracking-[0.18em] uppercase text-accent-primary";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, phone, dietary_tags, marketing_opt_in")
    .eq("id", user!.id)
    .maybeSingle();

  const provider = user!.app_metadata.provider ?? "email";
  const verified = Boolean(user!.email_confirmed_at);

  return (
    <>
      <h1 className="font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
        Settings.
      </h1>

      <section aria-label="Profile" className={`mt-12 border-t border-hairline pt-10 ${SECTION}`}>
        <h2 className={HEADING}>Profile</h2>
        <ProfileForm
          action={saveProfile}
          displayName={profile?.display_name ?? ""}
          phone={profile?.phone ?? ""}
          dietaryTags={profile?.dietary_tags ?? []}
        />
      </section>

      <section aria-label="Security" className={SECTION}>
        <h2 className={HEADING}>Security</h2>
        <dl className="mt-6 divide-y divide-hairline border-y border-hairline">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5">
            <dt className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase text-text-tertiary">
              Email
            </dt>
            <dd className="font-mono text-[13px] tracking-[0.02em] text-text-primary">
              {user!.email}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5">
            <dt className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase text-text-tertiary">
              Email status
            </dt>
            <dd
              className={`font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${
                verified ? "text-badge-live" : "text-badge-alert"
              }`}
            >
              {verified ? "Verified" : "Not verified yet"}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5">
            <dt className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase text-text-tertiary">
              Signed in with
            </dt>
            <dd className="font-mono text-[13px] tracking-[0.02em] text-text-primary">
              {PROVIDER_LABELS[provider] ?? provider}
            </dd>
          </div>
        </dl>
        <Link
          href="/auth/update-password"
          className="mt-6 inline-block font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          Change password
        </Link>
      </section>

      <section aria-label="Preferences" className={SECTION}>
        <h2 className={HEADING}>Preferences</h2>
        <p className="mt-6 max-w-md text-[15px] leading-[1.55] text-text-secondary">
          Order updates always send — they are how you know a drink is ready.
          Seasonal notes are the only thing you can turn off.
        </p>
        <PreferencesForm
          action={savePreferences}
          marketingOptIn={profile?.marketing_opt_in ?? false}
        />
      </section>

      <section aria-label="Delete account" className="py-10">
        <h2 className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase text-badge-alert">
          Delete account
        </h2>
        <DeleteAccountForm action={deleteAccount} />
      </section>
    </>
  );
}
```

- [ ] **Step 4: Exercise every form**

Run `pnpm dev`, open `/account/settings`.
- Save a name and phone → `SAVED.`, and the rail's name updates on reload.
- Save a phone of `abc` → `THAT PHONE NUMBER DOES NOT LOOK RIGHT.`
- Toggle seasonal notes → `SAVED.`, survives reload.
- Type `delete` (lowercase) into the confirm box → `TYPE DELETE TO CONFIRM.`
- On a throwaway account only, type `DELETE` → redirected to `/`, and the account is gone from the Supabase dashboard while its orders remain with `user_id` null.

- [ ] **Step 5: Verify**

Run: `pnpm lint && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add app/account/actions.ts app/account/settings/page.tsx components/account/SettingsForms.tsx
git commit -m "feat(account): settings with profile, preferences and account deletion"
```

---

### Task 11: Redeem at checkout

**Files:**
- Modify: `app/checkout/actions.ts`
- Modify: `lib/payment.ts`
- Modify: `components/checkout/CheckoutForm.tsx`
- Modify: `app/checkout/page.tsx`

**Interfaces:**
- Consumes: `quote_order(jsonb, uuid)` and `create_order(…, uuid)` from Task 3, `my_card()` from Task 2, `profiles` from Task 1
- Produces: `placeOrder` accepts `redeemItemId?: string`; `CheckoutForm` accepts `cardReady: boolean`, `punchableIds: string[]`, `defaultName: string`, `defaultPhone: string`

- [ ] **Step 1: Thread the redeem id through `placeOrder`**

In `app/checkout/actions.ts`, extend the input type and validate it:

```ts
export async function placeOrder(input: {
  items: OrderPayloadLine[];
  customerName: string;
  notes: string;
  paymentMethod: "online" | "counter";
  redeemItemId?: string;
}): Promise<PlaceOrderResult> {
```

After the existing per-line validation loop, add:

```ts
  // Only an id, never an amount. The database decides what the discount is
  // worth and whether the card is actually full.
  const redeemItemId = input.redeemItemId?.trim() || undefined;
  if (redeemItemId && !UUID.test(redeemItemId)) {
    return { ok: false, message: "That drink is not on the menu." };
  }
  if (redeemItemId && !input.items.some((line) => line.menu_item_id === redeemItemId)) {
    return { ok: false, message: "That drink is not in this order." };
  }
```

In the counter branch, pass it to the RPC:

```ts
    const { data, error } = await supabase.rpc("create_order", {
      p_items: input.items,
      p_customer_name: name,
      p_notes: notes,
      p_payment_method: "counter",
      p_redeem_item_id: redeemItemId,
    });
```

In the card branch, pass it to the quote:

```ts
  const { data: quote, error: quoteError } = await supabase.rpc("quote_order", {
    p_items: input.items,
    p_redeem_item_id: redeemItemId,
  });
```

and park it on the session so the webhook can replay it:

```ts
      metadata: {
        ...packed,
        customer_name: name,
        notes,
        ...(user && { user_id: user.id }),
        ...(redeemItemId && { redeem_item_id: redeemItemId }),
      },
```

- [ ] **Step 2: Fix the Stripe line items for the free unit**

Still in the card branch, the `line_items` map charges `unit × quantity`. A
redeemed line must charge one unit less. Replace the `quantity` and
`unit_amount` construction with a per-line split so Stripe shows the free cup:

```ts
      line_items: lines.flatMap((line) => {
        const unit =
          Number(line.base_price) +
          line.selected_modifiers.reduce(
            (sum, modifier) => sum + Number(modifier.priceOffset),
            0,
          );

        const description =
          line.selected_modifiers.length > 0
            ? line.selected_modifiers.map((modifier) => modifier.option).join(" / ")
            : undefined;

        // quote_order already zeroed one unit's worth off line_total; mirror
        // that split here so the customer sees which cup is on us.
        const free = Math.round(
          (unit * line.quantity - Number(line.line_total)) / unit,
        );
        const paid = line.quantity - free;

        const items = [];
        if (paid > 0) {
          items.push({
            quantity: paid,
            price_data: {
              currency: "eur" as const,
              unit_amount: Math.round(unit * 100),
              product_data: { name: line.item_name, ...(description && { description }) },
            },
          });
        }
        if (free > 0) {
          items.push({
            quantity: free,
            price_data: {
              currency: "eur" as const,
              unit_amount: 0,
              product_data: {
                name: line.item_name,
                description: description ? `${description} / On us` : "On us",
              },
            },
          });
        }
        return items;
      }),
```

`QuoteLine` gains `line_total: number` in its type declaration at the top of the file.

- [ ] **Step 3: Replay the redeem id in the webhook path**

In `lib/payment.ts`, inside `placeOrderFromSession`, pass the metadata through:

```ts
  const { data, error } = await db.rpc("create_order", {
    p_items: items,
    p_customer_name: session.metadata?.customer_name ?? "",
    p_notes: session.metadata?.notes ?? "",
    p_payment_method: "online",
    p_user_id: session.metadata?.user_id || undefined,
    p_stripe_session_id: session.id,
    p_stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : undefined,
    p_redeem_item_id: session.metadata?.redeem_item_id || undefined,
  });
```

- [ ] **Step 4: Offer the picker on the checkout page**

In `app/checkout/page.tsx`, fetch the card alongside whatever it already loads and pass it down:

```tsx
  const { data: card } = await supabase.rpc("my_card");
  const cardReady = Boolean((card as { ready?: boolean } | null)?.ready);
```

Pass `cardReady={cardReady}` into `<CheckoutForm />`.

In `components/checkout/CheckoutForm.tsx`, add the prop, hold the selection in state, and render the picker only when the card is full and the cart holds at least one drink. Add near the other form state:

```tsx
  const [redeemItemId, setRedeemItemId] = useState<string>("");
```

Render above the pay buttons:

```tsx
      {cardReady && drinkLines.length > 0 && (
        <div className="border-y border-hairline py-7">
          <p className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase text-accent-primary">
            Card full — one drink on us
          </p>
          <label className="sr-only" htmlFor="redeem">
            Which drink is on us
          </label>
          <select
            id="redeem"
            value={redeemItemId}
            onChange={(event) => setRedeemItemId(event.target.value)}
            className="mt-4 h-10 w-full max-w-sm rounded-md border border-border-subtle bg-surface-card px-3 font-mono text-[13px] tracking-[0.02em] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >
            <option value="">Keep the card for later</option>
            {drinkLines.map((line) => (
              <option key={line.menuItemId} value={line.menuItemId}>
                {line.name} — €{line.basePrice.toFixed(2)}
              </option>
            ))}
          </select>
        </div>
      )}
```

`drinkLines` is the cart filtered to items the card applies to. The client does
not know which categories earn a punch, so pass that down: `app/checkout/page.tsx`
already queries the menu — select `menu_categories(earns_punch)` alongside it and
hand `CheckoutForm` a `punchableIds: string[]`, then:

```tsx
  const drinkLines = lines.filter((line) => punchableIds.includes(line.menuItemId));
```

Include `redeemItemId: redeemItemId || undefined` in the `placeOrder` call.

- [ ] **Step 5: Prefill the name and phone from the profile**

This is the payoff for storing them (spec §9). In `app/checkout/page.tsx`, add to
the fetch:

```tsx
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("display_name, phone")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
```

Pass `defaultName={profile?.display_name ?? ""}` and
`defaultPhone={profile?.phone ?? ""}` into `<CheckoutForm />`, and use them as the
`defaultValue` of the existing name field and of the phone field if one exists —
if the form has no phone input, pass only the name and leave phone for a later
change. A returning customer should not have to type their name again.

Verify: sign in, save a name under `/account/settings`, open `/checkout`, and
confirm the name field is already filled.

- [ ] **Step 6: Test the whole path by hand**

With a test account whose card you fill through `execute_sql`
(`insert into order_items … earns_punch = true` on a committed order, or simply
place twelve counter orders for a drink):

1. `/checkout` shows the picker. Choose a drink.
2. Pay at the bar → the order total is one unit lower, `/account/card` shows the
   redemption, and the rail resets toward `1/12`.
3. Refill the card, choose card payment → the Stripe page lists the free cup at
   €0.00, and after paying the order total matches what Stripe charged.
4. With an empty card, call `placeOrder` with a `redeemItemId` from the browser
   console → `Your card is not full yet.`

- [ ] **Step 7: Verify**

Run: `pnpm lint && npx tsc --noEmit`
Run: `node --test lib/checkout.test.ts` — expected PASS, unchanged.

- [ ] **Step 8: Commit**

```bash
git add app/checkout/actions.ts lib/payment.ts components/checkout/CheckoutForm.tsx app/checkout/page.tsx
git commit -m "feat(checkout): redeem a full card against one drink, prefill from profile"
```

---

### Task 12: Favourites

**Files:**
- Create: `components/account/SaveItemButton.tsx`
- Modify: `components/storefront/MenuRow.tsx`
- Modify: `components/storefront/Storefront.tsx`
- Modify: `app/page.tsx`
- Modify: `app/account/page.tsx`

**Interfaces:**
- Consumes: `favourites` from Task 1
- Produces: `<SaveItemButton menuItemId={string} itemName={string} saved={boolean} />`

- [ ] **Step 1: Write the save control**

```tsx
// components/account/SaveItemButton.tsx
"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";

import { createClient } from "@/lib/client";
import { cn } from "@/lib/utils";

/**
 * Saving is a two-row-table write, so it goes straight to Supabase under the
 * "favourites insert own" policy rather than through a server action.
 */
export function SaveItemButton({
  menuItemId,
  itemName,
  saved: initial,
}: {
  menuItemId: string;
  itemName: string;
  saved: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !saved;
    setSaved(next); // optimistic — a failed save reverts below

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaved(!next);
      setBusy(false);
      return;
    }

    const { error } = next
      ? await supabase.from("favourites").insert({ user_id: user.id, menu_item_id: menuItemId })
      : await supabase.from("favourites").delete().eq("menu_item_id", menuItemId);

    if (error) {
      console.error("favourite toggle failed:", error.message);
      setSaved(!next);
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${itemName} from saved` : `Save ${itemName}`}
      className={cn(
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
        saved ? "text-accent-primary" : "text-text-tertiary hover:text-text-primary",
      )}
    >
      <Bookmark size={14} fill={saved ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
```

- [ ] **Step 2: Wire it into the menu row**

`MenuRow` renders one `<motion.button>` covering the whole row, inside a
`<motion.li>` (`components/storefront/MenuRow.tsx:45`). A nested button is
invalid HTML, so the control goes in as a **sibling of the button**, positioned
over the row's top-right corner.

Add `className="relative"` to the `<motion.li>`, then insert this immediately
after the closing `</motion.button>`, before `</motion.li>`:

```tsx
      {saved !== null && (
        <div className="absolute top-7 right-0 sm:top-9">
          <SaveItemButton menuItemId={item.id} itemName={item.name} saved={saved} />
        </div>
      )}
```

`MenuRow`'s props gain `saved: boolean | null` — `null` means signed out, and the
control is not rendered at all. Import `SaveItemButton` from
`@/components/account/SaveItemButton`.

`app/page.tsx` fetches the ids once and passes them through `Storefront` to each
row:

```tsx
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: saved } = user
    ? await supabase.from("favourites").select("menu_item_id")
    : { data: null };

  const savedIds = saved?.map((row) => row.menu_item_id) ?? null;
```

`Storefront` takes `savedIds: string[] | null` and forwards it; `MenuRow` takes
`saved: boolean | null`.

- [ ] **Step 3: Add the saved row to Overview**

In `app/account/page.tsx`, add to the parallel fetch:

```tsx
    supabase
      .from("favourites")
      .select("menu_item_id, menu_items(id, name, base_price, daily_stock, image_url)")
      .order("created_at", { ascending: false })
      .limit(6),
```

and render a section between "Your usual" and "Last order":

```tsx
      <section aria-label="Saved" className="border-b border-hairline py-8">
        <p className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase text-text-tertiary">
          Saved
        </p>

        {savedItems.length === 0 ? (
          <p className="mt-6 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
            Nothing saved yet.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
            {savedItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5"
              >
                <span className="font-mono text-[13px] tracking-[0.02em] text-text-primary">
                  {item.name}
                </span>
                <span
                  className={`font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${
                    item.daily_stock === 0 ? "text-badge-alert" : "text-text-tertiary"
                  }`}
                >
                  {item.daily_stock === 0 ? "Gone for today" : "On the menu"}
                </span>
                <span className="font-mono text-[13px] tracking-[0.02em] tabular-nums text-text-primary">
                  €{Number(item.base_price).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
```

- [ ] **Step 4: Check it works end to end**

Run `pnpm dev`. Signed out: no save controls on the menu. Signed in: save two
items, reload the storefront (they stay marked), open `/account` (both listed),
unsave one, reload (gone).

- [ ] **Step 5: Verify**

Run: `pnpm lint && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/account/SaveItemButton.tsx components/storefront/MenuRow.tsx components/storefront/Storefront.tsx app/page.tsx app/account/page.tsx
git commit -m "feat(account): save items from the menu and list them on Overview"
```

---

## Done when

- `/account`, `/account/orders`, `/account/orders/[id]`, `/account/card` and `/account/settings` all render, and the rail marks the right one active.
- A drink order raises the punch count; a pastry order does not; cancelling an order lowers it again.
- A full card discounts exactly one unit at checkout, on both payment routes, and writes one `card_redemptions` row.
- `supabase/tests/card.test.sql`, `supabase/tests/profiles.test.sql`, `supabase/tests/create_order.test.sql` and `supabase/tests/release_order.test.sql` all pass.
- `node --test lib/order-status.test.ts lib/cart.test.ts lib/checkout.test.ts lib/password.test.ts` passes.
- `pnpm lint` and `npx tsc --noEmit` are clean.
