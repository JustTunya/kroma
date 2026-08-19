# Customer Dashboard & The Card — Design

**Date:** 2026-08-19
**Status:** Approved, ready for implementation planning
**Supersedes:** the single-page `app/account/page.tsx`

---

## 1. Problem

`/account` is one page. It renders four `auth.users` fields, ten order rows, a
sign-out button and a link to the password form. Order rows are dead ends — no
detail view, no reorder. There is no `profiles` table, so a returning customer
retypes their name at every checkout. Nothing gives them a reason to come back.

This spec replaces it with a four-page account area and adds a loyalty
punchcard.

## 2. Goals

1. An account area that reads as a real place, not a debug screen.
2. Somewhere for personal data to live, so checkout can prefill it.
3. A loyalty mechanic that raises return frequency without cheapening the brand.
4. One-tap reorder, because habit outlives incentive.

## 3. Non-goals

Surprise free cup · loyalty tiers · referrals · saved payment methods · order
rating · gift cards · the barista KDS. Each is a later spec.

---

## 4. Loyalty: why a punchcard

The decision was punchcard over points, on three grounds.

**Goal-gradient effect** (Kivetz, Urminsky & Zheng 2006 — the coffee-card
study): purchase rate accelerates as a goal nears, but only when the goal is
visible, finite and close. A punchcard is all three. A points balance toward an
abstract catalogue is none of them, so it produces no acceleration.

**Endowed progress** (Nunes & Drèze 2006 — the car wash study): a 10-stamp card
with 2 stamps pre-filled reached 34% completion; an 8-stamp card from zero,
identical real effort, reached 19%. The framing nearly doubles completion. KROMA
therefore issues a **12-punch card with 2 punches already on it**.

**Register.** Points denominate loyalty in an exchange rate, which invites the
customer to price it in euros and reframes the relationship as a discount. A
punch is a gift. For a €4.20 cortado from a light-roast single origin, gift is
the only register consistent with the brand.

Supporting reasons: ticket variance is €3.50–€6.00, too narrow for points to buy
anything; and the card is already the specialty-coffee vernacular, so digitising
it is continuity rather than invention. Twelve glyphs on a hairline row is
existing design vocabulary — a progress bar and a redemption catalogue would not
be.

**No tiers.** Status ladders work for airlines because status buys operational
privilege. A café has nothing to upgrade; fake tiers read as corporate theatre
and break the tone rules in CLAUDE.md §1.

**No expiry.** Expiry is a loss-aversion lever that buys short-term visits and
spends trust. A premium brand cannot send "your reward expired".

### 4.1 Rules

| | |
|---|---|
| Card length | 12 punches |
| Grant at signup | 2 punches (endowed progress) |
| Earn | 1 punch per drink, no per-order cap |
| Qualifying | Categories with `earns_punch` — espresso-bar, filter-cold, tea-alternatives |
| Not qualifying | bakehouse, kitchen, retail beans |
| Burn | One free drink, customer picks at checkout |
| Expiry | None |

### 4.2 Accepted gap

The card rewards frequency and ignores spend. A daily-espresso regular earns the
same as someone spending €40 a week on beans and pastry. If retail beans become
a real revenue line, solve it with a separate mechanic — do not convert the card
to points.

### 4.3 Copy

Never "Rewards", never "Loyalty Program". The card is "your card"; punches are
"cups".

```
YOUR CARD
● ● ● ● ● ● ● ○ ○ ○ ○ ○
Seven cups in. Five to go.
```

Full card: `Card full. One drink on us — pick it at checkout.`
Empty card: `Two cups on the card to start you off.`

---

## 5. Data model

Balance is **derived from orders**, not stored. `orders` and `order_items`
already are the ledger; a punch count is a view of purchase history, not new
state. The only new state is which orders burned a card.

This makes refunds self-healing: cancelling or refunding an order removes its
rows from the sum and the punch disappears. **No reversal webhook is required**,
provided refunds set `status = 'cancelled'`.

Rejected alternatives:

- *Event ledger* (`loyalty_events` with deltas) — the balance is a `sum()`
  either way, so it adds a table and a write path that can disagree with
  `orders`. Two sources of truth for one fact.
- *Counter column on `profiles`* — fastest read, and the one that breaks. Drifts
  silently, refund correction is a blind decrement that can go negative, and
  there is no way to reconstruct the truth when a customer disputes it.

### 5.1 Schema

```sql
-- which categories earn a punch. Beans and pastry do not.
alter table menu_categories add column earns_punch boolean not null default false;
update menu_categories set earns_punch = true
 where slug in ('espresso-bar', 'filter-cold', 'tea-alternatives');

-- snapshot, for the same reason item_name and base_price are snapshotted:
-- re-categorising the menu must not rewrite an existing card retroactively.
alter table order_items add column earns_punch boolean not null default false;

create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text,
  phone            text,
  dietary_tags     text[] not null default '{}',
  marketing_opt_in boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table card_redemptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  order_id      uuid not null unique references orders(id) on delete cascade,
  punches_spent smallint not null default 12,
  item_name     text not null,
  created_at    timestamptz not null default now()
);

create index card_redemptions_user_idx on card_redemptions (user_id, created_at desc);

-- saved items, for the Overview row. Deliberately a join table and nothing
-- more: no notes, no ordering, no folders.
create table favourites (
  user_id      uuid not null references auth.users(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, menu_item_id)
);
```

`profiles` has no insert trigger on signup. Reads use `maybeSingle()` and treat
null as empty; the first save upserts. One less thing to keep in sync.

`profiles` gets the existing `set_updated_at()` trigger.

### 5.2 Balance

```
card_punches(p_user) = SUM(order_items.quantity)
                         where earns_punch and orders.status <> 'cancelled'
                     - SUM(card_redemptions.punches_spent)
                     + 2
```

The `+ 2` is the endowed-progress grant. It is a constant in the function, not a
row, so it applies exactly once by construction and cannot be double-granted.

### 5.3 Functions and RLS

| Function | Caller | Notes |
|---|---|---|
| `card_punches(uuid)` | internal | `revoke execute from anon, authenticated` |
| `my_card()` | client | No argument. Uses `auth.uid()`. Returns `{ punches, ready, redeemed_count }` |
| `my_usual()` | client | No argument. Most-ordered item by summed quantity, with the modifier set from its most recent order |

Client-facing functions take no user argument so one account cannot read
another's card.

RLS:

- `profiles` — select / insert / update own (`auth.uid() = id`).
- `card_redemptions` — select own. **No insert policy.** Only `create_order`,
  which is `security definer`, writes it.
- `favourites` — select / insert / delete own (`auth.uid() = user_id`).

---

## 6. Earning and burning

### 6.1 Earning

No new code path. `create_order` already inserts `order_items` for both the
Stripe webhook and the counter route, so it sets `earns_punch` from the item's
category in that same insert. The balance function does the rest.

`create_order` is the single funnel for both payment methods. Putting the logic
there rather than in the webhook is what makes one implementation cover both.

### 6.2 Burning

An optional redeem argument threads through both pricing functions:

```
quote_order(p_items, p_redeem_item_id)
create_order(..., p_redeem_item_id)
```

Both are required. Stripe line items are built from `quote_order`'s output; if
only `create_order` knew about the discount, the customer would be charged full
price for a discounted order.

Redeem branch inside `create_order`:

1. `pg_advisory_xact_lock(hashtext(v_user::text))` — serialises this user's
   redemptions and releases with the transaction. `create_order` is already the
   serialization point for stock.
2. Recount punches server-side via `card_punches`. The client's claim of a full
   card is never trusted.
3. Verify the named item is present in the cart and its category has
   `earns_punch`.
4. Subtract **one unit's price** from that line's `line_total` — not the whole
   line. A line of quantity 3 yields one free cortado and two paid ones. Unit
   price is `base_price` plus the line's modifier offsets, the same arithmetic
   `order_lines` already performs.
5. Insert `card_redemptions`.

Guests cannot redeem. The checkout UI offers the picker only when the customer is
signed in and `my_card().ready` is true.

### 6.3 Accepted loss

A customer with a full card starts two checkouts concurrently and pays both. The
second reaches `create_order` with a spent card.

Refunding a whole paid order over €4.20 is worse than absorbing it. The order is
placed at the discounted price, the redemption row is skipped, and the event is
logged. The loss is bounded to one drink and requires genuinely concurrent
checkout from one account.

Marked in the SQL with a `ponytail:` comment naming the ceiling.

---

## 7. Information architecture

```
/account              Overview
/account/orders       History
/account/orders/[id]  One order
/account/card         The card
/account/settings     Profile / Security / Preferences / Danger
```

Four rooms. Enough that the area feels real, few enough that none is empty.
"Your usual" and saved items live on Overview rather than taking pages of their
own.

### 7.1 Shell

Desktop: a `sticky top-16` left rail in a `md:border-l border-hairline` column
split — the rule already in CLAUDE.md §4, so no new layout vocabulary. Labels are
mono-uppercase; active is `text-primary`, inactive `text-tertiary`.

Below `md`: the horizontal pill rail already built for `CategoryNav` — sticky
under the header, `scrollbar-hide`, with a `layoutId="activeAccountNav"` span so
the fill slides between pills.

The rail shows the live punch count beside the CARD label, so progress is visible
from every page in the area.

`proxy.ts` already guards `/account` with `startsWith`, which covers every child
route. No change required.

### 7.2 Files

```
app/account/layout.tsx              rail, mobile pills, shared fetch
app/account/page.tsx                Overview
app/account/orders/page.tsx         History
app/account/orders/[id]/page.tsx    Order detail
app/account/card/page.tsx           The card
app/account/settings/page.tsx       Settings
app/account/actions.ts              server actions
components/account/AccountNav.tsx   rail + pills (client, for layoutId)
components/account/PunchCard.tsx    the twelve glyphs
components/account/ReorderButton.tsx
lib/order-status.ts                 status LABELS, lifted from OrderStatus.tsx
```

The layout is a server component fetching user, profile and `my_card()` once and
passing them down, so the four pages do not each re-query the same three things.

---

## 8. Page contents

### Overview

- Greeting keyed to opening hours — `Good morning.` before 12:00, matching the
  hours in CLAUDE.md §1.
- Punch strip with count.
- `YOUR USUAL` — most-ordered item with a one-tap **Order again**.
- Last order, with live status when unsettled.
- Saved items row, reading `favourites`.

The saving affordance itself lives on the storefront, not here: `MenuRow` gains
a save control for signed-in customers, and Order detail can save any line. Both
are small additions to existing components, but they are the only part of this
spec that reaches outside `/account` and checkout — worth naming so it is not a
surprise during implementation.

### Orders

Hairline-divided list using the same row grammar as `MenuRow`: order number,
date, item count, status, total. The whole row is a link to detail.

Paginated with `?page=`, 20 per page, server-rendered. Not infinite scroll — an
order history is a reference document, and a URL for page 3 is worth having.

Empty state is a single mono sentence between two hairlines, per CLAUDE.md §10.
Never an illustration.

### Order detail

Full line breakdown with modifiers, live status, `Order again`. Reads the order
directly under the `orders read own` policy rather than by access token.

**Reorder behaviour:** lines are pushed into the existing cart via `useCart`,
then the customer is routed to `/checkout`. Items now at `daily_stock = 0` are
skipped, and the skip is stated in brand voice — `Two lines are gone for today.`

### Card

The twelve glyphs at display size, redemption history, and a plain-language
explanation of how the card works in brand voice.

### Settings

Four sections on one page:

- **Profile** — name at the bar, phone, dietary tags.
- **Security** — email and verification state, sign-in provider, link to the
  existing `/auth/update-password`. Read-mostly.
- **Preferences** — order updates (transactional, always on, shown for
  transparency), seasonal notes (`marketing_opt_in`, toggleable).
- **Danger** — delete account.

Profile and preferences save per section, not through one global Save.

**Account deletion** requires typing `DELETE`, then a server action calling
`auth.admin.deleteUser` with the service-role client. `profiles` and `carts`
cascade; `orders.user_id` is already `on delete set null`, so the bakehouse keeps
its records while the customer is anonymised. This is the only new use of the
service role outside the webhook and cron.

---

## 9. Existing code touched

| File | Change |
|---|---|
| `app/account/page.tsx` | Rewritten as Overview; header moves to the new layout |
| `components/checkout/OrderStatus.tsx` | `LABELS` extracted to `lib/order-status.ts`, imported back |
| `app/checkout/actions.ts` | Pass `redeemItemId` to `quote_order`; discount the Stripe line |
| `lib/payment.ts` | Carry `redeem_item_id` through session metadata into `create_order` |
| `components/checkout/CheckoutForm.tsx` | Redeem picker, rendered only when the card is full |
| `components/storefront/MenuRow.tsx` | Save control, signed-in only |
| `supabase/migrations/` | Two new migrations: schema, then functions |
| `types/supabase.ts` | Regenerated |

Checkout prefills name and phone from `profiles` — the payoff for storing them.

---

## 10. Testing

Extends the existing `supabase/tests/*.test.sql` pattern.

`card.test.sql`
- A pastry order adds no punches.
- A cancelled order's punches do not count.
- The `+2` grant applies once, not per order.
- Redemption discounts exactly one unit of the named line and burns exactly 12 —
  a line of quantity 3 loses one unit price, not three.
- A second redemption against an empty card still places the order, with no
  `card_redemptions` row.
- Redeeming an item absent from the cart raises.
- Redeeming a non-drink raises.

`profiles.test.sql`
- User B cannot read or write user A's profile.
- `my_card()` under B's JWT returns B's count, never A's.

`lib/order-status.test.ts`
- The label map is exhaustive over the `order_status` enum.

---

## 11. Dependency worth stating

Nothing in the codebase writes `collected` — that needs the barista KDS, which
does not exist. A punch therefore currently means "paid for", not "drank".

This does not block the build, but it has a visible consequence: the new Order
detail page shows status prominently, so an order parked at `paid` forever is
more conspicuous there than on today's account page. The KDS is the obvious next
spec.
