# Store Dashboard — Live Orders, Staff Identity & Permissions — Design

**Date:** 2026-08-22
**Status:** Approved, ready for implementation planning
**Depends on:** `2026-08-18-checkout-design.md`, `2026-08-19-account-dashboard-design.md`

---

## 1. Problem

KROMA can take an order and charge for it. Nothing on the shop side can *see* it.

`orders` has a `status` enum with six values and not one line of code writes any
of them after the Stripe webhook sets `paid`. `ready_at` has never been written.
A customer watching `/order/[token]` sees "On the pass" forever, because there is
no pass — no screen behind the bar, no way for a barista to say the flat white is
made, no way for anyone to say the cinnamon buns are gone before the counter runs
out.

There is also no concept of an employee anywhere in the codebase. `auth.users` is
customers. RLS grants a person their own orders and nothing else. The service-role
key is deliberately confined to two files (`app/api/stripe/webhook`,
`app/api/cron/release-holds`), and correctly so — there is currently no third
place with a legitimate reason to write another person's order.

This spec introduces that third place: a staff-side dashboard, the identity model
underneath it, and the permission boundary that keeps a curious customer out of it.

## 2. Goals

1. A live order board a barista can work a rush on, updating without a refresh.
2. Order status that means something — written by the people making the coffee.
3. An identity model that survives how a café actually operates: one shared iPad,
   nobody logs out, seasonal staff without a work email.
4. A per-person audit trail for every action that touches money or stock.
5. A permission boundary that holds even if the UI is bypassed entirely.

## 3. Non-goals

Offline write queue · per-barista performance metrics · manual punch grants ·
customer messaging · inventory tracking beyond `daily_stock` · shift scheduling ·
payroll · supplier orders · table service · printed receipts beyond
`window.print()` · a native app.

Several of these are refused with a reason — offline queue §13.5, manual punch
grants §15.14, per-barista metrics §18 — rather than merely deferred. Read those
before proposing them again.

---

## 4. Scope and sequencing

What was described is four subsystems. This spec covers two to implementation
depth and defines the interface of the other two so they can be built later
without re-litigating the foundation.

| | Subsystem | This spec |
| :--- | :--- | :--- |
| **A** | Staff identity, roles, sessions, RLS | Full depth |
| **B** | Live order board, status transitions, realtime | Full depth |
| **C** | Ops admin — menu, stock, staff management, shop settings | Interface only (§17) |
| **D** | Analytics | Interface only (§18) |

A and B are the pair that has to ship together: identity without a board is
unusable, and a board without identity is unsafe. C and D each get their own spec.

---

## 5. Architecture

Three options were weighed.

**Supabase-native** — staff are `auth.users`, the browser reads and writes
`orders` directly, RLS carries every rule. Cheapest, but a status change is then a
bare `UPDATE` with no room for the audit row, the stock restore, or the Stripe
refund that must happen in the same transaction.

**Server-authoritative** — nothing staff-side touches Supabase; every read and
write is a server action holding the service-role key, with a hand-rolled
WebSocket route fed by `LISTEN/NOTIFY`. Total control, and you own connection
fanout, reconnect, and heartbeat for a shop with one iPad and a phone.

**Hybrid — chosen.**

* **Reads and live push:** the browser subscribes with `supabase-js` on the
  station session. Supabase Realtime *is* a WebSocket, so the live requirement is
  met without running a socket server. RLS decides what a station may see.
* **Writes:** every state change goes through a server action that verifies the
  actor cookie and calls a `security definer` RPC. One transaction covers the
  status change, the audit row, and the stock movement, so they cannot drift.
* **Permissions:** one SQL function, `staff_can()`, called by both RLS policies
  and the RPCs. Not duplicated between policy SQL and TypeScript.

The hybrid extends patterns the repo already has. `order_by_token()` and
`my_card()` are `security definer` RPCs that project exactly what a caller may
see. `release_order()` cancels and restores stock in one transaction. The service
role is confined to the two files with no user session. This design adds a fourth
`security definer` family and one new session type; it introduces no new
architectural idea.

---

## 6. Identity model

```sql
create type staff_role as enum ('owner', 'manager', 'staff');

create table staff (
  id           uuid primary key default gen_random_uuid(),
  -- Null for a PIN-only employee. Set once a person needs off-premises login.
  user_id      uuid unique references auth.users(id) on delete set null,
  kind         text not null default 'person'
                 check (kind in ('person', 'station')),
  display_name text not null,               -- "Ana"  /  "Bar iPad"
  role         staff_role not null default 'staff',
  -- A default VIEW, never a permission. See below.
  station      text not null default 'bar'
                 check (station in ('bar', 'kitchen')),
  pin_hash     text,                        -- crypt(pin, gen_salt('bf', 10))
  failed_pins  smallint not null default 0,
  locked_until timestamptz,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- A station cannot act: no PIN, therefore no actor session, ever.
  constraint station_has_no_pin check (kind = 'person' or pin_hash is null)
);

create index staff_user_idx   on staff (user_id) where user_id is not null;
create index staff_active_idx on staff (is_active, display_name);

create trigger staff_updated_at before update on staff
  for each row execute function set_updated_at();
```

**Why `kind` is a column and not a second table.** The bar iPad needs a row so it
can hold a Supabase session and appear in the audit trail as *where* something
happened. It is not a person: it never appears in the roster picker and it can
never obtain the right to write. That is two behaviours, not two entities — one
column, one check constraint.

**Why `station` is a view and not a permission.** In a five-person shop the person
nearest the machine helps, regardless of what the rota says. Making bakehouse a
permission means the baker cannot touch a drink order during a rush, which is
exactly backwards. `station` sets which lane the board opens on. Nothing more.

**Employees are created by the owner, not invited by email.** The owner types a
name; the system generates a 4-digit PIN and shows it **once**. That person can
work the board on their next shift with no inbox, no magic link, and no password
reset flow for someone who works two shifts a week. Managers and the owner
additionally get a real `auth.users` row (email + password) so they can reach the
dashboard from home — `staff.user_id` links the two.

A `staff` row is **never deleted.** Leaving is `is_active = false`. Deleting the
row would orphan every audit event that person ever generated, which defeats the
purpose of having them.

---

## 7. Sessions — two layers

The café floor reality: one iPad behind the bar, screen on all shift, three people
touching it, nobody logging out. A design that assumes shift-boundary login
produces an audit log that lies. Two layers instead:

| Layer | What it is | Lifetime | Grants |
| :--- | :--- | :--- | :--- |
| **Station session** | A real `auth.users` row (`bar@kroma.local`) whose `staff` row has `kind='station'`; refresh token lives on that device | Months | The board renders. Read only. |
| **Actor session** | httpOnly, secure, sameSite=lax signed cookie `kroma_actor` = `{staff_id, iat, exp}` | 15 min, sliding on activity | The right to write, attributed to a person |

Flow: roster picker → 4-digit PIN → writes unlocked for 15 minutes of activity.
This is standard POS practice (Square, Toast and Lightspeed all use a short
employee PIN over a persistent terminal session) and it is the only model that
survives contact with a rush.

**PIN handling.** The PIN never leaves the server. The pad posts it to a server
action, which calls `staff_unlock(p_staff_id, p_pin)` — `security definer` —
verifying with `crypt(p_pin, pin_hash) = pin_hash`. `pgcrypto` is already enabled
by the initial migration. Four digits is 10,000 combinations, so the lockout is
not optional:

* 5 consecutive failures → `locked_until = now() + interval '15 minutes'`
* Every lockout writes a `staff_events` row, so the owner sees it
* A successful unlock resets `failed_pins` to 0

**Sensitive actions re-prompt regardless of cookie freshness.** Void, refund,
discount, staff management, and customer-contact reveal each require a fresh PIN
entry even inside a valid actor window. The cookie proves someone unlocked the
terminal fifteen minutes ago; it does not prove the person now holding it is the
manager.

**Cookie signing** uses `STAFF_SESSION_SECRET` (new env var, server-only). No
database session table: no cleanup job, no extra round trip per write. The
trade-off is recorded in §21.

---

## 8. Permissions

One function. Both callers read it.

```sql
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
```

`item.86` is deliberately available to everyone. The person who discovers the last
bun is gone is the person holding the empty tray, and making them find a manager
means the storefront keeps selling something that does not exist.

The `else false` default means a typo in an action name denies rather than grants.

**TypeScript mirrors this table in `lib/staff-permissions.ts` for the sole purpose
of hiding buttons.** It is never the authorization decision. A test keeps the two
in sync (§19).

**No per-person permission overrides.** Three fixed bundles for five people. An
override grid is a settings screen to build, an audit surface that gets confusing,
and a way to accidentally hand a barista the refund button.

---

## 9. Defence in depth — keeping customers out

`proxy.ts` is user experience, not security. Five layers, each of which holds
alone:

1. **Proxy gate.** `/dashboard/*` requires a session whose `staff` row exists and
   is active; otherwise redirect to `/`. Extends the `/account` block already in
   `lib/middleware.ts`. A redirect, not a 403 — a 403 confirms the route exists.

2. **RLS.** The staff read policy on `orders` and `order_items`:

   ```sql
   create policy "orders staff read" on orders
     for select using (
       exists (select 1 from staff
                where staff.user_id = auth.uid()
                  and staff.is_active)
     );
   ```

   A customer hitting `supabase-js` directly with their own perfectly valid JWT
   matches nothing here, and the existing `orders read own` policy still scopes
   them to their own rows. This is the layer that matters, because it is the one
   an attacker actually reaches.

3. **Fresh role read on every write.** Each RPC re-reads `role` and `is_active`
   from `staff` by the cookie's `staff_id`. It never trusts a role claim carried
   in the cookie. This closes the revocation gap: flip `is_active` on someone
   mid-shift and their live 15-minute cookie stops working at the next write.

4. **Service role stays confined.** The dashboard never uses
   `SUPABASE_SERVICE_ROLE_KEY`. It remains the webhook's and the cron's, as
   documented in `lib/admin.ts`.

5. **Surface reduction.** `/dashboard` is `noindex`, unlinked from the storefront,
   and the PIN is verified only inside a `security definer` function — never
   compared in application code, never logged.

A stolen station session is worth almost nothing: `kind='station'` means no
`pin_hash`, which means no actor cookie can ever be minted, which means the thief
gets a read-only board and cannot void, refund, edit, or open analytics. That
property falls out of the constraint in §6 rather than needing its own check.

---

## 10. Bootstrap

```sql
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

  -- Self-closing: the first caller becomes owner, every later one is refused.
  if exists (select 1 from staff where role = 'owner') then
    raise exception 'This shop already has an owner.' using errcode = 'P0001';
  end if;

  insert into staff (user_id, display_name, role)
  values (auth.uid(), p_display_name, 'owner')
  returning id into v_id;

  return v_id;
end;
$$;
```

No seed row with a known password, no env allowlist to maintain. The owner signs
up through the existing customer auth flow, calls this once, and the door closes
behind them.

---

## 11. Audit

```sql
create table staff_events (
  id         bigint generated always as identity primary key,
  staff_id   uuid references staff(id) on delete set null,   -- who
  station_id uuid references staff(id) on delete set null,   -- where
  action     text not null,        -- 'order.advance', 'order.void', 'item.86', …
  subject_id uuid,                 -- order id, menu item id, staff id
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index staff_events_recent_idx  on staff_events (created_at desc);
create index staff_events_subject_idx on staff_events (subject_id, created_at desc);
create index staff_events_staff_idx   on staff_events (staff_id, created_at desc);
```

Append-only by construction: no update policy, no delete policy, and insert is
revoked from every role. Only `security definer` RPCs write here, as a side effect
of the action they are already performing — never as a separate call the caller
could skip.

Read is `analytics.view` (manager+). `detail` carries before/after state for
transitions and the amount for refunds and discounts.

---

## 12. Order lifecycle

### 12.1 What the schema already does

Confirmed by reading `20260819091905_pay_before_order.sql:241` — an **online**
order is inserted as `paid` (it cannot exist before Stripe clears), and a
**counter** order is inserted as `pending`. So on this board `pending` means
*"ordered on the site, money not taken yet."* That is the shop's collection risk
and it gets its own visible treatment, not a hidden queue.

### 12.2 State machine

```
pending ──▶ paid ──▶ preparing ──▶ ready ──▶ collected
   │          │          │            │
   └──────────┴──────────┴────────────┴──▶ cancelled   stock returns; online → Stripe refund
                                collected ──▶ refunded  money returns; stock does NOT
```

Every transition goes through one RPC:

```sql
create function advance_order(
  p_order_id uuid,
  p_to       order_status,
  p_actor    uuid,
  p_station  uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
```

In a single transaction it: re-reads the actor's `role` and `is_active`; calls
`staff_can()` for the action the transition implies; validates the transition
against the map above; stamps the matching timestamp; and inserts the
`staff_events` row.

Transition → action → timestamp, stated explicitly so the implementation has
nothing to infer:

| Transition | `staff_can` action | Writes |
| :--- | :--- | :--- |
| `pending` → `paid` | `order.advance` | — (cash taken at the counter) |
| `paid` → `preparing` | `order.advance` | `started_at`, `claimed_by` |
| `preparing` → `ready` | `order.advance` | `ready_at` |
| `ready` → `collected` | `order.advance` | `collected_at` |
| one lane back, ≤ 90s | `order.advance` | clears the timestamp it undoes |
| one lane back, > 90s | `order.undo_late` | clears the timestamp it undoes |
| any pre-collected → `cancelled` | `order.void` | restores `daily_stock`; online triggers a Stripe refund |
| `collected` → `refunded` | `order.refund` | `detail.amount`; **no** stock restore |

Any transition not in this table is rejected. Any failure rolls back all of it, so an audit row without a
state change — or the reverse — is not representable.

**Backwards transitions are allowed and necessary.** "Ready" gets pressed early
constantly. Any staff member may step one lane back within **90 seconds**; past
that it is `order.undo_late` (manager+). Both write audit rows. A hard one-way
machine gets worked around with voids and re-rings, which is worse for the data
than a logged undo.

`pending` → `paid` is a staff action meaning *cash taken at the counter*. Stripe
owns `pending` → `paid` for online orders and staff never touch those.

### 12.3 Schema changes this forces

1. **`refunded` added to `order_status`.** Distinct from `cancelled` because the
   stock consequence is opposite: a cancelled order never left the pass and its
   stock returns; a refunded one was eaten and it does not.

2. **`card_punches()` must be updated in the same batch.** It currently filters
   `o.status <> 'cancelled'`. Without adding `refunded`, a refunded order keeps
   earning punches and refunds mint free coffee. This is the single highest-risk
   line in the whole spec.

3. **`orders` gains three columns:**

   ```sql
   alter table orders
     add column started_at   timestamptz,
     add column collected_at timestamptz,
     add column claimed_by   uuid references staff(id) on delete set null;
   ```

   `ready_at` already exists and has never been written; the board starts writing
   it. These four timestamps are what spec D computes prep time from, and they are
   **unrecoverable after the fact** — if B does not write them, that history is
   simply gone.

4. `lib/order-status.ts` gains a `refunded` label, and `isSettled()` must return
   true for it or the customer's confirmation page polls forever.

### 12.4 Stock, outside the lifecycle

```sql
create function set_item_stock(p_item_id uuid, p_stock integer, p_actor uuid, p_station uuid)
returns integer
language plpgsql
security definer
set search_path = public
```

Gated by `item.86` (everyone), audited, and the only way the dashboard writes
`menu_items.daily_stock`. Passing `0` is the 86 button; passing a number is the
morning bake count. `null` means unlimited, matching the existing column
semantics for espresso-bar drinks.

---

## 13. The board

**Route:** `/dashboard/board`. Full `kds-*` dark canvas per CLAUDE.md §2 — this is
the one surface that is a kitchen display, not a document. Every other dashboard
route uses the normal warm-neutral system; a manager reading numbers is not
standing at a hot bar.

### 13.1 Lanes

| Lane | Statuses | Treatment |
| :--- | :--- | :--- |
| **On the pass** | `pending`, `paid` | `pending` cards carry a terracotta `TAKE PAYMENT` marker |
| **Brewing** | `preparing` | shows `claimed_by` display name |
| **Ready at the bar** | `ready` | elapsed-since-ready timer — the number that matters |
| **Collected** | `collected` today | collapsed strip, expandable |

Below `lg`, lanes collapse to one scrollable column with a lane switcher built
from the existing `CategoryNav` pill pattern.

### 13.2 Card

Order number in oversized mono, elapsed timer, `bar_name`, lines with their
modifiers, notes, allergen flags. Age colouring reuses existing tokens: under 5
minutes `kds-text-primary`, 5–10 `accent-primary`, over 10 `badge-alert`.

### 13.3 Realtime — subscribe thin, fetch fat

```ts
supabase.channel('board')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onOrderEvent)
  .subscribe()
```

Subscribe to `orders` **only**. `order_items` rows arrive in a separate
replication message from their parent `orders` insert, so subscribing to both
renders a card with no lines for a few hundred milliseconds on every new order.
Instead, any event on `orders` triggers a re-fetch of that one order through
`staff_order(id)` — an RPC returning the same jsonb shape `order_by_token()`
already returns, plus the staff-only fields. One round trip, never inconsistent.

Requires `alter publication supabase_realtime add table orders;`.

### 13.4 Connection state is a first-class UI element

Café wifi drops. A board that silently stops updating loses orders and loses trust
permanently, so the connection state is always on screen:

```
LIVE              badge-live, reusing the 2.4s ambient pulse from CLAUDE.md §9
RECONNECTING      accent-primary
OFFLINE — 14:32   badge-alert, naming the last time data was fresh
```

While disconnected: fall back to a 30-second poll. On reconnect: re-fetch the
**entire board**, not deltas — an event missed while the socket was down is
otherwise invisible forever.

### 13.5 Writes are refused while offline

Queuing writes for later replay is an explicit non-goal. Two iPads reconciling
divergent order state after a reconnect is a correctness disaster far worse than
ten minutes on paper. The offline fallback is a **Print pass list** button —
`window.print()` against current board state. Native, zero dependencies, works
when nothing else does.

### 13.6 Audio

A new order plays one soft ping. iPadOS blocks audio until a user gesture, so the
board mounts behind a *"Tap to start shift"* overlay that both unlocks
`AudioContext` and writes the shift-start `staff_events` row. One interaction, two
jobs.

### 13.7 Motion

Cards use `layout="position"` (CLAUDE.md §9.5), enter on `rise`, and exit at
`{ duration: 0.12, ease: "easeOut" }`. Lanes never re-animate wholesale — twelve
orders in six minutes must not produce a reflow storm. `useReducedMotion()`
degrades the status pulse to a steady dot and card movement to instant, per
CLAUDE.md §9.

---

## 14. Customer information and GDPR

Cluj-Napoca is in the EU, so this is data minimisation as a legal obligation, not
a preference.

**Visible to any staff member on the order card** — the minimum required to make
and hand over the order correctly:

* `bar_name` from `profiles` (the column exists for exactly this: the name called
  over the pass, distinct from the account's `display_name`)
* `avoid_allergens`, rendered `badge-alert`
* punch-card state and lifetime order count — *"24th order / card ready"*

**Behind `customer.contact` (manager+), and every reveal writes a `staff_events`
row:** email, phone, full order history, spend.

A barista does not need a phone number to make a cortado. Making the reveal a
logged, permissioned action rather than an ambient column is the difference
between a system that respects customers and one that merely stores them.

---

## 15. Real-life scenarios

Each is handled by a mechanism already defined above. None adds a feature.

| # | Situation | Handling |
| :--- | :--- | :--- |
| 1 | Order sits `ready` for 40 minutes, nobody comes | Flags `badge-alert` past 30 minutes and sorts to the top of its lane. Staff marks collected or voids. **Never auto-cancels, never auto-refunds.** |
| 2 | A tray is dropped — physical stock no longer matches the count | `set_item_stock(item, 0)`. Any open paid order containing that item immediately flags `CONTAINS 86'D ITEM` on the board over the same realtime channel. Storefront shows "Gone for today" within 30s via the existing `revalidate = 30`. |
| 3 | Two baristas reach for the same drink | `claimed_by`. Moving a card to `preparing` claims it; the other device shows the name in the same tick. |
| 4 | "Actually, make it oat" — at the bar, after payment | Append a note (`order.note`, any staff). **Line items are never edited after payment.** A price change means void and re-ring. Editing priced lines post-payment is a money hole. |
| 5 | A counter order walks out without paying | `pending` older than 45 minutes shows `LAPSED`. A manager voids it and stock returns. Deliberately not automatic — a human decides. |
| 6 | Bad shot; customer wants money back after collection | Manager+ → `refunded`. Online: Stripe refund through the existing `stripe` dependency. Cash: the till moves the money and the system **records** it as a `staff_events` row carrying the amount. The dashboard is a ledger here, not a payment processor. |
| 7 | Barista fired mid-shift | Owner flips `is_active`. §9 layer 3 kills their live actor cookie at the next write. The row is never deleted. |
| 8 | PIN written on the wall by the grinder | Not preventable, only visible. `staff_events` gives an actions-by-person view and PIN rotation is one tap. A small shop runs on social trust; the system's job is a record, not a prison. |
| 9 | Twelve orders in six minutes | §13.7. |
| 10 | Trainee's first solo shift | Already handled by the role model — `staff` cannot void, refund, discount, or touch the menu. No trainee tier needed. |
| 11 | Order placed at 09:00 for 15:00 pickup | `pickup_at` already exists. Scheduled orders sit in a collapsed drawer and promote into the live lane at `pickup_at` minus the prep window. |
| 12 | Someone walks off with the bar iPad | `kind='station'` → no `pin_hash` → no actor cookie is obtainable. Read-only board, no writes, no analytics. Falls out of §6. |
| 13 | Internet drops mid-rush | §13.4 and §13.5: last state held, `OFFLINE` shown with a timestamp, writes refused, print fallback. |
| 14 | "I should have a free coffee by now" | The manager panel shows the derived count from the existing `card_punches()`. **A manual punch grant is refused** — the account spec derives the balance from `orders` precisely so refunds self-heal, and an override column breaks that invariant silently and permanently. A genuinely owed customer gets a comped drink, which is a discount, is logged, and leaves the card honest. |
| 15 | End of day | The Collected lane resets on the shop's day boundary, not midnight UTC. Until spec C ships a settings page, `Europe/Bucharest` is hardcoded behind a `ponytail:` comment. |

---

## 16. Routes

```
/dashboard              redirect to /board for every role — the numbers are one tap away
/dashboard/board        the daily driver, kds-* canvas       [order.view]
/dashboard/order/[id]   lines, notes, audit trail, actions   [order.view]
/dashboard/unlock       roster picker + PIN pad; also the lock screen
/dashboard/menu         stock, 86, prices, featured          [menu.edit]      → spec C
/dashboard/staff        roster, roles, PIN rotation, audit   [staff.manage]   → spec C
/dashboard/settings     hours, timezone, ordering window     [shop.settings]  → spec C
/dashboard/numbers      the day, the week                    [analytics.view] → spec D
```

---

## 17. Spec C — ops admin (interface only)

**Consumes from A:** `staff_can('menu.edit' | 'staff.manage' | 'shop.settings')`,
the actor cookie, and a `staff_events` row for every write.
**Consumes from B:** nothing.

**Owns:** morning stock reset (typing in the day's bake counts), item
activate/deactivate, price and modifier editing, the existing `is_featured`
toggle, shop hours plus timezone, and the ordering window that decides whether the
storefront accepts an order at 17:58.

**Defers:** image upload pipeline, category CRUD, scheduled price changes.

---

## 18. Spec D — analytics (interface only)

**Consumes from A:** `staff_can('analytics.view')`.
**Consumes from B:** `started_at`, `ready_at`, `collected_at`. This is the
coupling that matters — see §12.3.3. If B does not write them, D has nothing to
compute prep time from and that history cannot be reconstructed.

**Owns:** covers, revenue, average ticket, item mix, prep-time p50/p90,
hour-of-day histogram, 86 events as a waste proxy, new versus returning. Built as
SQL views and RPCs, never client-side aggregation over raw orders.

**Explicit non-goal: per-barista performance metrics.** `staff_events` exists for
accountability — who voided that order — not for ranking staff by seconds per
drink. Shipping that leaderboard changes what the audit log is *for*, and a
five-person shop does not survive it.

---

## 19. Testing

Matching the conventions already in the repo — `node --test` for TypeScript,
`begin`/`rollback` SQL files with `do $$ … end $$` assert blocks for the database.

**`supabase/tests/staff.test.sql`**

* `staff_unlock` accepts the right PIN, rejects the wrong one
* five failures set `locked_until`; a locked row refuses a *correct* PIN
* a successful unlock resets `failed_pins`
* `staff_can` returns the expected value for all three roles across every action
* the `station_has_no_pin` constraint rejects a station row carrying a PIN
* a customer JWT selecting from `orders` sees no staff-scoped rows
* `advance_order` rejects an illegal transition (`collected` → `preparing`)
* `advance_order` rejects an actor whose `is_active` is false, even with a valid
  cookie payload
* void restores `daily_stock`; refund does **not**
* `claim_owner` succeeds once and raises on the second call
* `card_punches` excludes a `refunded` order

**`lib/staff-permissions.test.ts`** — the TypeScript mirror matches the SQL table
action for action, role for role. This test is the only thing preventing the UI
and the database from disagreeing about who may refund.

**`lib/order-transitions.test.ts`** — the transition map, and the 90-second undo
boundary in both directions.

---

## 20. Migration ordering

This will bite if it is got wrong, so it is stated twice.

1. `…_staff_identity.sql` — enum `staff_role`, `staff`, `staff_events`,
   `staff_can`, `staff_unlock`, `claim_owner`, RLS policies.
2. `…_order_status_refunded.sql` — **only** `alter type order_status add value
   'refunded';`. Postgres will not let a new enum value be *used* in the same
   transaction that adds it, so it gets its own file with nothing else in it.
3. `…_order_board.sql` — the three new `orders` columns, `advance_order`,
   `staff_order`, `set_item_stock`, the `card_punches` fix, the `refunded` label
   in `lib/order-status.ts`, and
   `alter publication supabase_realtime add table orders;`.

Step 3 must include the `card_punches` change. Shipping 2 and 3 without it means
every refunded order keeps its punches.

---

## 21. Known ceilings

Marked with `ponytail:` comments at the relevant lines.

* **Actor sessions are a signed cookie, not a database table.** No cleanup job and
  no extra query per write, at the cost of no instant remote kill of an in-flight
  session. §9 layer 3 caps the exposure at one already-authorized write. Upgrade
  path: a `staff_sessions` table with a revocation check inside `advance_order`.
* **Four-digit PINs.** 10,000 combinations, mitigated by lockout and audit rather
  than by length, because six digits is where staff start writing them down.
  Upgrade path: configurable length in shop settings.
* **`Europe/Bucharest` is hardcoded** until spec C ships shop settings.
* **No offline write queue**, by decision (§13.5), not by omission.
* **`staff_events` has no retention policy.** At this volume it will not matter for
  years. Upgrade path: monthly partitioning if it ever does.
