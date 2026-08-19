# KROMA Checkout — Design

**Date:** 2026-08-18
**Status:** Approved, ready for implementation planning

## Summary

Turn the disabled `Checkout` button in `CartDrawer` into a working order flow.
The customer chooses how to pay: **online** (Stripe Checkout) or **at the bar**
(no payment provider involved). Both write the same order. Guests can check out
without an account; signed-in customers get order history.

Prices and stock are settled by the database, never by the client.

---

## 1. Decisions

| Question | Decision |
|---|---|
| Payment | Both online and at-the-bar, chosen by the customer at checkout |
| Who can check out | Guests allowed; account optional. Guests hold an unguessable order token |
| Stock | Atomic decrement inside the order-creation transaction; online orders hold stock until a deadline |
| Hold duration | 30 minutes — exactly the Stripe Checkout Session expiry, one deadline only |
| Surface | Dedicated `/checkout` page + `/order/[token]` confirmation/status page |
| Pickup time | ASAP only (`now() + 10 min`). Stored in `pickup_at` so slots need no migration later |
| Stripe integration | Stripe Checkout, hosted redirect |
| Migrations | Applied directly against the hosted Supabase project |

### Rejected

- **Shopify / Vercel `commerce` integration** — the catalog already lives in
  Supabase (`menu_categories`, `menu_items`, modifiers JSONB, `daily_stock`).
  Shopify would replace it, not extend it. Category is `payments`, not `commerce`.
- **Stripe Payment Element (embedded)** — buys "no page leave" at the cost of
  owning the entire 3DS/SCA surface, which is mandatory in the EU. Highest-risk
  code in the feature for a €4.20 cortado.
- **15-minute hold with cron release** — the Stripe session lives 30 minutes
  regardless, so a 15-minute hold lets a customer pay at minute 20 for stock
  already given away. Trades a soft cost (a bun briefly unsellable) for a hard
  one (money taken and refunded, customer disappointed at the counter).
- **`stripe_events` idempotency ledger** — unnecessary. Both webhook transitions
  are guarded by `where status = 'pending'`, so replays no-op naturally.
- **`charge.refunded` handling** — no refund path exists yet. `ponytail:` comment
  plus one more webhook case when it does.

---

## 2. Data model

One migration. Extends the existing `orders` table; no new tables.

### `orders` — seven new columns

| Column | Type | Purpose |
|---|---|---|
| `user_id` | `uuid references auth.users(id) on delete set null` | Order history. Nullable = guest order |
| `access_token` | `uuid not null default gen_random_uuid()`, unique | Guest capability key, carried in the URL |
| `payment_method` | `text not null check (in ('online','counter'))` | Which money path |
| `pickup_at` | `timestamptz` | ASAP writes `now() + interval '10 minutes'` |
| `expires_at` | `timestamptz` | Stock-hold deadline. `null` for counter orders — they never expire |
| `stripe_session_id` | `text unique` | Reconciliation; the unique constraint prevents duplicate sessions per order |
| `stripe_payment_intent_id` | `text` | Refunds and support lookups |

Indexes: unique on `access_token`; `(user_id, placed_at desc)`;
partial `(expires_at) where status = 'pending'` for the release sweep.

### Status semantics — no enum change

The existing `order_status` enum is sufficient. Counter and online orders are
distinguished by two fields already present:

- `pending` + `online` → awaiting Stripe. Holds stock until `expires_at`.
- `pending` + `counter` → **confirmed**. Barista takes the money at the bar.
- `paid` → money received, either route.
- `preparing` / `ready` / `collected` → kitchen-side, unchanged.
- `cancelled` → stock released.

### Row Level Security

- `orders` / `order_items`: signed-in users read their own
  (`auth.uid() = user_id`, and a join-based policy for items). **No anon policy.**
- Guests read through `order_by_token(p_token uuid)`, a `SECURITY DEFINER`
  function returning exactly the one matching order plus its items.

Consequence: the storefront never needs the service role key. Only the Stripe
webhook and the cron route do.

---

## 3. `create_order()`

```sql
create function create_order(
  p_items          jsonb,   -- [{ menu_item_id, quantity, modifiers: [{group, option}] }]
  p_customer_name  text,
  p_notes          text,
  p_payment_method text
) returns orders
language plpgsql security definer set search_path = public
```

Single transaction: it all lands, or none of it does.

### The client sends no prices

Not `basePrice`, not `priceOffset`, not a total. Only item ids, quantities, and
modifier **names**. `CartLine` carries prices for rendering; if any of them
reached the order write, a hand-crafted request would buy a €4.20 cortado for
€0.01.

### Per line

Items are processed **sorted by `menu_item_id`**. Two concurrent transactions
locking rows in different orders is a deadlock; sorting removes it.

1. `select … from menu_items where id = … and is_active for update`.
   The row lock is what serializes two people buying the last bun.
2. **Modifier resolution.** For each `{group, option}` the client sent, locate
   that group in the item's own `modifiers` JSONB, locate the option inside it,
   read `priceOffset` **from the database row**. Unknown group or option →
   reject. Then enforce each group's `required` / `min` / `max`.
3. **Stock.** `daily_stock is null` → unlimited, skip. Otherwise
   `daily_stock < quantity` → raise. Else decrement in place.
4. `line_total = (base_price + Σ offsets) × quantity`, all `numeric`.
   No floating point touches money.

### Insert

`orders` with `status = 'pending'`, `user_id = auth.uid()` (null for guests),
subtotal/total from the accumulator, `pickup_at = now() + interval '10 minutes'`,
and `expires_at = now() + interval '30 minutes'` for `online` / `null` for
`counter`. Then the `order_items` snapshots.

### Errors

`raise exception using errcode = 'P0001', message = 'Cardamom Bun — only 2 left',
detail = '{"menu_item_id": "…"}'`. PostgREST passes message and detail through,
so `/checkout` can render the failure on the offending summary row in KROMA
voice rather than showing a generic error.

### Companion functions

- `order_by_token(p_token uuid)` — `SECURITY DEFINER`, returns one order + items.
- `release_order(p_order_id uuid)` — returns each line's quantity to
  `menu_items.daily_stock`, sets `status = 'cancelled'`, guarded by
  `where status = 'pending'` so it is idempotent.
- `release_expired_orders()` — `release_order` for every `pending` + `online`
  order past `expires_at`. Cron backstop.

---

## 4. Application wiring

### New dependency

`stripe` — the only addition. Webhook signature verification is HMAC over the
raw body with a timestamp tolerance; not something to hand-roll.

### Files

```
lib/stripe.ts                        server-only Stripe client
lib/admin.ts                         service-role Supabase client, `import "server-only"`
lib/use-cart.ts                      extracted hook (refactor, see below)
lib/checkout.ts                      CartLine[] → RPC payload (price-stripping transform)
app/checkout/page.tsx                server: auth prefill; empty cart → redirect "/"
app/checkout/actions.ts              "use server" — placeOrder()
components/checkout/CheckoutForm.tsx
components/checkout/OrderSummary.tsx
app/order/[token]/page.tsx           server: rpc order_by_token, 404 on miss
components/checkout/OrderStatus.tsx  client poller, 15s, stops at collected/cancelled
app/api/stripe/webhook/route.ts
app/api/cron/release-holds/route.ts
vercel.ts                            crons entry
```

`lib/admin.ts` is the only file that reads `SUPABASE_SERVICE_ROLE_KEY`, and it is
imported by exactly two route handlers.

### Refactor: `useCart()`

`Storefront.tsx:34-79` holds cart hydration, guest/server merge, and persistence
inline. `/checkout` needs the identical behavior — guest `localStorage` vs the
`carts` table. Extracting to `useCart()` returning
`{ lines, ready, add, setQuantity, remove, clear }` is the only way to avoid a
second copy, and it shrinks `Storefront` at the same time. This duplication would
be *introduced* by this feature, so the extraction is in scope.

### `placeOrder` server action

```
rpc('create_order', { p_items, p_customer_name, p_notes, p_payment_method })
  │
  ├─ counter → { url: `/order/${access_token}` }
  │
  └─ online  → Stripe Checkout Session built from the RETURNED order_items,
               never from the client cart:
                 unit_amount  = round((base_price + Σ priceOffset) × 100)
                 expires_at   = order.expires_at        (one deadline, shared)
                 metadata.order_id, client_reference_id = order.id
                 payment_method_types: ['card']
                 success_url = cancel_url = /order/${access_token}
               save stripe_session_id
             → { url: session.url }
```

The action returns a URL instead of calling `redirect()` so the client clears the
cart *before* navigating; a server redirect would strand it.

Unit price is computed once from `base_price + Σ priceOffset` and converted to
integer cents once, at the Stripe boundary. Never round twice; never divide a
line total by quantity.

### Webhook — the only thing that means "paid"

Raw body via `await req.text()` (`req.json()` breaks the signature), then
`stripe.webhooks.constructEvent`.

- `checkout.session.completed` — **guard on `session.payment_status === 'paid'`**.
  `completed` alone does not mean money moved for asynchronous methods. Then
  `update orders set status='paid', stripe_payment_intent_id=…, expires_at=null
  where id=… and status='pending'`.
- `checkout.session.expired` — `rpc('release_order')`.

Both updates are guarded on `status = 'pending'`, which *is* the idempotency —
no event ledger needed. Return `400` only on signature failure; `200` for
everything else including unknown events. Never `500` on business logic, or
Stripe retries for three days.

`payment_method_types: ['card']` — Apple Pay and Google Pay ride along free, and
it sidesteps the SEPA asynchronous-settlement path entirely.

### Cron backstop

`vercel.ts` → `{ path: '/api/cron/release-holds', schedule: '0 * * * *' }`. The
route verifies the `CRON_SECRET` bearer header and calls
`release_expired_orders()`. Catches stock stranded by a webhook that never
arrived.

---

## 5. Screens

Both follow the existing brand guide (`CLAUDE.md` §1-§11) — hairline structure,
mono-uppercase labels, no cards, no new radii.

### `/checkout`

`md:grid-cols-2` split by `md:border-l border-hairline`, no gap (§5). Left:
customer name, notes, payment-method toggle. Right: order summary as
`divide-y divide-hairline border-y border-hairline`.

Payment method is two `aria-pressed` pills with a `layoutId` fill sliding between
them — the same component grammar as `CategoryNav`. Labels: **"Pay now"** /
**"Pay at the bar"**.

Submit is the primary CTA: `bg-accent-primary text-surface-card`,
`whileTap={{ scale: 0.98 }}`.

Stock and validation errors render on the offending summary row in `badge-alert`,
in operational voice: *"Cardamom Bun — only 2 left."*

Empty cart on arrival → redirect to `/`.

`CartDrawer`'s currently-disabled button becomes a link to `/checkout`, enabled
whenever the cart is non-empty.

### `/order/[token]`

Order number in the hero serif clamp. `Ready 08:14` and the item ledger in mono.
Status pill in `badge-live`. `OrderStatus.tsx` re-polls the RPC every 15s and
stops at `collected` or `cancelled`.

Guests get the token pushed into `localStorage['kroma-orders']` so a recent order
stays findable without an account.

### `/account`

Gains a recent-orders list. `user_id` exists now, and the page already claims
*"Orders placed from here are held under your name."* — currently untrue.

---

## 6. Build order

Each step ships on its own.

| # | Step | Done when |
|---|---|---|
| 1 | Migration: columns, indexes, RLS, `create_order`, `order_by_token`, `release_order`, `release_expired_orders`. Regenerate `types/supabase.ts` | SQL tests pass |
| 2 | `useCart()` extraction; `Storefront.tsx` refactored onto it | app behaves identically |
| 3 | `/checkout` — form, summary, **counter path only**. `CartDrawer` button becomes a link | order writes, stock decrements |
| 4 | `/order/[token]` + poller | **counter checkout works end to end** |
| 5 | Stripe session — `lib/stripe.ts`, online branch of `placeOrder` | redirect reaches Stripe test checkout |
| 6 | Webhook, verified with `stripe listen` / `stripe trigger` | **online checkout works end to end** |
| 7 | Cron backstop, `vercel.ts`, `/account` orders list | holds release, history renders |

Step 4 is a real milestone: a working "order ahead, pay at the bar" café. If
Stripe stalls on account setup, the feature has still shipped.

---

## 7. Testing

Two runnable checks, matching the `node --test` convention already used by
`lib/cart.test.ts` and `lib/password.test.ts`.

### `lib/checkout.test.ts`

Covers the pure `CartLine[] → RPC payload` transform. The assertion that matters:
**no price field survives.** `basePrice`, `priceOffset`, and any computed total
must be absent from the serialized payload. That is the tamper boundary, and the
only part of it testable without a database.

### `supabase/tests/checkout.test.sql`

Plain `do $$ … assert … $$` blocks. Run against the hosted project wrapped in
`begin … rollback`, so every assert exercises the real schema and nothing
persists.

1. Client sends `priceOffset: -100` → order total matches the database price.
2. Unknown modifier option → raises, zero rows inserted.
3. `quantity` exceeds `daily_stock` → raises, **and** `daily_stock` is unchanged
   (rollback proven, not assumed).
4. Two sequential orders for the last 3 buns: first succeeds, second raises.
   (`for update` covers the truly concurrent case; a single-connection script
   cannot express it.)
5. `release_order` restores the exact quantity and flips status once — a second
   call restores nothing extra.

### Manual (step 6)

`stripe trigger checkout.session.completed`, then trigger it a second time to
prove the replay no-ops.

---

## 8. Environment & operations

Already present in `.env.local`, all server-only, none `NEXT_PUBLIC_`:

```
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

- **Local webhook development** needs the Stripe CLI
  (`stripe listen --forward-to localhost:3000/api/stripe/webhook`). Not installed
  yet — blocks step 6 only.
- **Production keys** come from the Vercel Marketplace Stripe integration
  (`vercel integration add stripe`) at deploy time, so live secrets are never
  copy-pasted. The repo is not linked to Vercel yet; this is a deploy-time step.
- `CRON_SECRET` is supplied by Vercel for the cron route.
- Migrations are applied against the **hosted** Supabase project via the Supabase
  MCP `apply_migration`, with `generate_typescript_types` refreshing
  `types/supabase.ts` in the same step.

---

## 9. Risks

- `types/supabase.ts` goes stale the instant the migration lands. Regenerating it
  is part of step 1, not an afterthought.
- Stripe CLI absence blocks step 6 only; steps 1-5 proceed without it.
- A 30-minute hold on a scarce batch item is a real product cost. It is the
  correct trade against a refund race, but if abandonment proves high, the lever
  is fewer batch-limited items exposed to online payment — not a shorter hold.
