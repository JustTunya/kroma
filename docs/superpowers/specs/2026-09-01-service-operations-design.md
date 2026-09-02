# Service Operations — Day Cycle, Money, Menu & Receipts — Design

**Date:** 2026-09-01
**Status:** Ready for implementation planning
**Depends on:** `2026-08-18-checkout-design.md`, `2026-08-22-store-dashboard-design.md`

---

## 1. Problem

KROMA can take an order, charge for it, make it and settle it. It cannot **run a
day**.

Concretely, on the morning of day two:

* `daily_stock` still holds yesterday's leftovers. Twelve croissants were sold,
  the column says `0`, and the storefront says "Gone for today" over a full tray.
  Nothing anywhere resets it.
* `order_number` comes from a global sequence that never resets. By week three
  the bar is calling "four hundred and eighty-two".
* Counter orders are marked `payment_method = 'counter'` and nothing records
  whether the customer handed over cash or tapped a card. The drawer cannot be
  counted, so theft and till errors are structurally invisible.
* Changing a price means writing a SQL migration. `menu.edit` exists in
  `staff_can()` and has no surface behind it.
* No customer ever receives a receipt. `subtotal` and `total` are the same
  number because no VAT is broken out anywhere, so the shop's books cannot be
  filed from this data.
* A customer who orders must keep the tab open and watch a 15-second poll. There
  is no way to tell them the flat white is on the bar.
* A barista who spills a drink has no way to comp it. `order.discount` exists in
  `staff_can()` and has no surface behind it either.

Every one of these is a *day-shaped* gap: the schema models orders well and
models the trading day not at all. This spec introduces the service day, and
hangs the money, the menu, the receipt and the notification off it.

## 2. Goals

1. A day that is deliberately opened and deliberately closed, with stock and
   ticket numbers scoped to it.
2. A drawer that can be counted, against an expected figure the system computes.
3. Prices, items and modifiers editable by a manager without a deploy.
4. A receipt every customer can read, print or receive by email, carrying a
   correct VAT breakdown.
5. A customer who can walk away from the counter and be told when to come back.
6. A manager who can comp or discount an order, with a reason, on the record.

## 3. Non-goals

Ingredient-level inventory · rota planning · staff-management UI · scheduled
pre-orders · tips · station routing (bar vs kitchen) · order amendment after
placement · waste logging as its own table · multi-location · offline write
queue. All of these are named in the P1 list and none of them are prerequisites
for the seven features here.

**Explicitly out of scope, and important:** this does not make KROMA fiscally
compliant in Romania. A *bon fiscal* must come from certified fiscal hardware
(casă de marcat electronică fiscală) registered with ANAF. What §9 builds is a
commercial receipt — a correct, itemised proof of purchase with a VAT
breakdown — which is what the customer wants and what the accountant reconciles
against. The fiscal printer sits beside it, not inside it. Say this in the
copy; do not let the receipt page imply otherwise.

---

## 4. The service day

### 4.1 Model

```sql
create table service_days (
  day           date primary key,           -- the shop-local calendar day
  opened_at     timestamptz not null default now(),
  opened_by     uuid references staff(id) on delete set null,
  closed_at     timestamptz,
  closed_by     uuid references staff(id) on delete set null,
  next_number   integer not null default 1,
  float_cash    numeric(8,2) not null default 0,
  counted_cash  numeric(8,2),
  count_detail  jsonb,
  report        jsonb                       -- the Z-report, frozen at close
);
```

One row per trading day, keyed by the shop-local date — `shop_tz()` already
exists and already answers "which day is it here". The row's existence means
"opened"; `closed_at is null` means "still trading". There is no `status`
column, because two nullable timestamps already say everything a status enum
would and cannot disagree with themselves.

`orders` gains:

* `service_day date references service_days(day)` — which day's takings this is.
* `day_number integer` — the ticket number the bar calls.
* `settled_as text check (settled_as in ('cash','card','online'))` — how the
  money actually arrived (§6).

`order_number` **stays**, untouched, as the permanent global identifier. It is
already unique-indexed and already the key humans use in the ledger. The
customer-facing number becomes `day_number`. Rewriting `order_number` to restart
daily would break its unique index and buy nothing.

`menu_items` gains `par_stock integer` — the number to bake to, null meaning
unlimited, exactly as `daily_stock` already means unlimited when null. Opening
a day copies `par_stock` into `daily_stock`.

### 4.2 Ticket numbering

`service_days` carries `next_number`. `create_order()` does:

```sql
update service_days set next_number = next_number + 1
 where day = v_day returning next_number - 1 into v_number;
```

The row lock serialises it, it lives in the transaction that already exists, and
two concurrent checkouts cannot collide. No sequence, no advisory lock, no gap
recovery — a voided order keeps its number, which is what a paper ticket book
does too.

### 4.3 Opening

`open_service(p_actor uuid, p_stock jsonb default null) returns service_days`

* Guarded by a **new** `shop.open` action, granted to **everyone on shift**. The
  person who arrives first opens the shop. Making them find a manager at 07:15
  means the storefront takes orders against yesterday's stock — the same
  reasoning that already puts `item.86` in every barista's hands.
* Idempotent: a day already open returns its row and writes nothing. Two iPads
  tapping Open must not produce two openings, exactly as `shift_mark()` refuses
  to double-stamp a shift.
* Sets `daily_stock = par_stock` for every active item, then applies the
  per-item overrides in `p_stock` (`{"<item_id>": 14}`) so the opening screen's
  edited counts win.
* Audits `shop.open` into `staff_events` with the stock map in `detail`.

### 4.4 The closed shop refuses orders

`create_order()` and `quote_order()` raise `'The bakehouse is closed.'` when no
service day is open. This is the point of the whole feature: without it, a card
order arrives at 03:00 with nobody to make it and money already taken.

The storefront must therefore *know*, and say so before the customer builds a
cart. `app/page.tsx` reads the open day alongside the menu and passes
`serviceOpen: boolean` into `Storefront`.

### 4.5 Closing

`close_service(p_actor uuid, p_counted numeric, p_detail jsonb) returns jsonb`

* Guarded by a **new** `shop.close` action, **manager and owner only**. This is
  the money, not the bread.
* **Refuses while any order is live** (`pending`, `paid`, `preparing`, `ready`),
  returning the count and the ticket numbers. You cannot close a till over an
  unresolved order; the staff must collect, void or write off each one first.
  The error names them so the close screen can link straight to them.
* Freezes `service_report()` into `report`, writes `counted_cash`,
  `count_detail`, `closed_at`, `closed_by`. Audits `shop.close`.

---

## 5. UI — the day

### 5.1 The board is the front door

`/dashboard/board` is the screen the first person of the day unlocks into, so
that is where the day opens. When there is no open service day, `OrderBoard`
renders `ServiceClosed` **instead of** the lanes — the same full-bleed
`fixed inset-0 bg-kds-canvas` treatment `ShiftStart` already uses, in the same
place in the component tree, for the same reason: a screen with one deliberate
tap on it beats a banner nobody presses.

```
                                          ← full-bleed kds-canvas, items-end

  SERVICE / TUESDAY 2 SEPTEMBER

  Nothing is
  open yet.                               ← serif clamp(56px,10vw,148px)
                                            "open" in accent-primary <em>

  ── hairline ────────────────────────────
  CROISSANT              PAR 18    [ 18 ]  ← mono 11px / number input, tabular
  CINNAMON BUN           PAR 12    [ 12 ]
  SOURDOUGH LOAF         PAR  6    [  6 ]
  CARDAMOM BUN           PAR 14    [ 14 ]
  ── hairline ────────────────────────────
  ESPRESSO BAR / UNLIMITED                 ← one mono line, no inputs

           ( Open service )                ← accent-primary pill, h-10
```

Only items with a non-null `par_stock` get a row and an input — espresso-bar
drinks are unlimited and are stated once, as a fact, not listed as sixteen
disabled fields. Each input is `<input type="number" inputMode="numeric">` on a
hairline underline, mono `15px`, `tabular-nums`, prefilled at par. Editing one
is the normal case, not an exception: Tuesday's bake is not Monday's.

A locked terminal (no PIN) sees the same screen with the button disabled and
`Unlock with your PIN to open the day.` underneath, mirroring how `OrderDetail`
already handles `!role`.

### 5.2 The day pill

`StaffBar` gains one pill between `ConnectionPill` and the shift button:

* Open: `DAY / 07:32` in `kds-text-secondary`, linking to `/dashboard/day`.
* Not open: `CLOSED` in `badge-alert`, same link.

It is text, not an icon, because the state matters more than the affordance —
and it is the only place mid-service that answers "did anyone actually open?"

### 5.3 `/dashboard/day`

The day, as a page, for the manager who wants the numbers before close.

```
  ← THE PASS

  SERVICE / TUESDAY 2 SEPTEMBER
  Opened 07:32 by Ana                     ← mono 11px, / separated

  Forty-one                               ← serif clamp(32px,4vw,52px)
  on the day.                                spelled, then the ledger below

  ── hairline ────────────────────────────
  TAKEN                            €412.60
  CASH                             €188.40
  CARD AT THE BAR                  €121.20
  ONLINE                           €103.00
  ── hairline ────────────────────────────
  VAT 11%                           €40.87
  NET                              €371.73
  ── hairline ────────────────────────────
  DISCOUNTED                        −€6.40
  VOIDED                            €12.80
  REFUNDED                           €0.00
  BINNED                             €4.20
  ── hairline ────────────────────────────
  LEFT ON THE COUNTER      4 CROISSANT / 1 SOURDOUGH

           ( Count the drawer )           ← manager+ only
```

Same `Ledger`-style hairline rows the numbers page already uses. Below `lg`
nothing changes — it is already a single column of label/value pairs.

### 5.4 `/dashboard/day/close` — counting the drawer

Two blocks split by a border, per CLAUDE.md §5.

**Left: the count.** One row per denomination, largest first. Each row is
`label / input / running subtotal`:

```
  €50      [  2 ]        100.00
  €20      [  6 ]        120.00
  €10      [  4 ]         40.00
  €5       [  3 ]         15.00
  €2       [ 11 ]         22.00
  €1       [  7 ]          7.00
  50c      [ 12 ]          6.00
  20c      [  8 ]          1.60
  10c      [  5 ]          0.50
  ── hairline ──────────────────
  COUNTED                292.10        ← serif, oversized
```

The subtotal column animates through `numberTransition` on every keystroke —
this is the one screen where a number changing under your hands is the whole
point. Inputs are `type="number"`, `inputMode="numeric"`, mono, `tabular-nums`.

**Right: the reconciliation.**

```
  FLOAT                            €100.00
  CASH TAKEN                       €188.40
  CASH REFUNDED                     −€0.00
  ── hairline ────────────────────────────
  EXPECTED                         €288.40
  COUNTED                          €292.10
  ── hairline ────────────────────────────
  OVER BY                            €3.70     ← badge-alert when ≠ 0
                                                  badge-live when exactly 0
        ( Close the day )
```

Variance is stated as `OVER BY` / `SHORT BY` / `SQUARE` — operational words, not
"variance". `SQUARE` in `badge-live` is the reward for a careful count.

If orders are still live, the CTA is replaced by the refusal in `badge-alert`:
`4 still on the pass — #038 / #039 / #041 / #042`, each a link to its order.
This is a better empty-handed state than a disabled button, because it tells you
what to go and do.

Below the fold: the same Z-report block from `/dashboard/day`, so what you are
signing off is on the same screen as the signature.

---

## 6. Tender — how the money arrived

`payment_method` answers *where* (online / counter) and cannot answer *what*
(cash / card). Reconciliation needs the second. Adding `settled_as`:

* `'online'` — written by `create_order()` for card orders. Nothing to ask.
* `'cash'` / `'card'` — written at the `pending → paid` transition, which is
  exactly the moment the barista takes the money.

`advance_order()` gains `p_tender text default null` and **requires** it when a
counter order moves `pending → paid`. Stepping back `paid → pending` clears it,
because the money went back in the customer's pocket.

### UI

`ADVANCE_LABELS.pending` is currently the single string `"Paid at counter"`.
It becomes two buttons wherever that one button is drawn — `OrderRow` on the
board and `OrderDetail`:

```
   ( Cash )  ( Card )        ← both accent-primary, h-9 / h-10, side by side
```

Two taps become one. This is strictly faster than the current single button
*and* it is the only way the drawer can be counted, which is the rare change
that improves the UX and the books at once.

Everywhere an order's payment is described — `OrderDetail`'s meta line, the
board row, the ledger, the receipt — `"Counter"` becomes `"Cash"` / `"Card"`,
falling back to `"Counter"` for rows that predate the column.

---

## 7. VAT

### 7.1 Rates

Romania since 1 August 2025: standard **21%**, reduced **11%** covering food,
non-alcoholic drinks, and restaurant and catering services. Everything KROMA
currently sells is 11%; alcohol, if it is ever listed, is 21%.

The rate therefore hangs off the **category**, not off eat-in vs takeaway — both
are 11% here. `menu_categories` gains `vat_rate numeric(4,3) not null default
0.11`. The earlier claim that fulfilment drives the rate was wrong, and no
`fulfilment` column is added: a column that changes no number is not worth its
migration.

### 7.2 Inclusive pricing

Displayed prices are gross, as EU consumer law requires and as `base_price`
already is. VAT is extracted, never added:

```
vat  = gross − gross / (1 + rate)
net  = gross − vat
```

`order_lines()` resolves and returns `vat_rate` per line alongside `earns_punch`
— it already reads the category for `earns_punch`, so this is one more column on
a join that exists. `order_items` snapshots `vat_rate` for the same reason it
snapshots `base_price`: a rate change in 2027 must not rewrite 2026's books.
`orders` gains `tax_total numeric(8,2) not null default 0`.

Historical orders are backfilled from their items' categories in the same
migration. A shop's books do not get to have a gap.

### 7.3 UI

One line, everywhere money is totalled — `OrderSummary`, `/order/[token]`, the
receipt, `/dashboard/day`:

```
  TOTAL                     €14.60
  INCL. VAT 11%              €1.45      ← mono 11px, text-tertiary
```

Never a second total. The customer pays €14.60; the VAT line is information
about that number, not an addition to it, and it is set at metadata weight so it
never reads as one.

---

## 8. Menu management

### 8.1 Writes

Three security-definer RPCs, all guarded by the existing `menu.edit`
(manager and owner), all auditing to `staff_events`:

* `menu_upsert(p_actor uuid, p_item jsonb) returns menu_items`
* `menu_reorder(p_actor uuid, p_ids uuid[])`
* `menu_category_upsert(p_actor uuid, p_category jsonb)`

The audit `detail` carries a **diff**, not the whole row: `{"base_price":
{"from": 4.20, "to": 4.50}}`. Price history is the single most valuable thing
this table can record, and a full-row dump buries it.

`modifiers` is validated inside `menu_upsert` against the exact shape
`order_lines()` parses — an array of `{name, required, min, max, options:
[{name, priceOffset}]}`, every `priceOffset` a number, every group and option
name non-empty and unique within its scope. A malformed modifier group does not
surface as a bad edit; it surfaces three days later as a checkout that raises
`that selection is not on the menu` for every customer. Validation lives in the
one function that writes, not in a CHECK constraint, because the constraint
would have to be `immutable` and would fail retroactively on rows the app has
already written.

Deleting is `is_active = false`. Nothing is ever removed: `order_items.
menu_item_id` is `on delete set null`, and a hard delete silently anonymises
history.

### 8.2 `/dashboard/menu`

The staff-side twin of the storefront list. Same editorial rows, `kds-*` canvas.

```
  ESPRESSO BAR   FILTER & COLD   PASTRY   BEANS      ← pill rail, layoutId
                                            ( + Item )

  ── hairline ───────────────────────────────────────
  Cortado                                      €4.20
  UNLIMITED / VEGAN OPTION / 2 GROUPS         ↑  ↓
  ── hairline ───────────────────────────────────────
  Cinnamon Bun                                 €4.80
  PAR 12 / 4 LEFT / NUTS                      ↑  ↓
  ── hairline ───────────────────────────────────────
  Sourdough Loaf                               €7.50
  OFF THE MENU                                ↑  ↓     ← whole row text-tertiary
  ── hairline ───────────────────────────────────────
```

The row body is a button opening the sheet; `↑ ↓` are separate buttons calling
`menu_reorder` optimistically. Reordering is two mono glyphs rather than drag —
it works with a keyboard, it works with a wet thumb on an iPad, and it costs no
dependency. The meta line reuses the storefront's `/`-separated mono vocabulary
exactly.

### 8.3 The item sheet

Right-anchored slide-over, full height, no radius, `x: "100%" → 0` on `spring`
over a `bg-text-primary/25` backdrop — identical to `CartDrawer`, because a
staff drawer that moves differently from the customer drawer is two things to
maintain and two things to learn.

```
  EDIT ITEM                                    ✕

  NAME
  Cortado_______________________________

  SLUG            cortado          (auto)
  CATEGORY        [ ESPRESSO BAR ▾ ]
  PRICE           € 4.20
  PAR STOCK       ____   ← blank = unlimited
  DESCRIPTION
  Two ristretto shots, steamed milk._____

  DIETARY     ( VEGAN )( VEGAN OPTION )( GF )
  ALLERGENS   ( MILK )( NUTS )( GLUTEN )( SOY )

  ── hairline ──────────────────────────────
  MODIFIER GROUPS                    ( + Group )

  MILK CHOICE                    REQUIRED  ✕
    Whole Milk            €0.00           ✕
    Oat Milk (Vegan)      €0.60           ✕
    ( + Option )

  SIZE                           REQUIRED  ✕
    Single                €0.00           ✕
    Double                €0.80           ✕
    ( + Option )
  ── hairline ──────────────────────────────

  ( ON THE MENU )                    ← aria-pressed toggle pill

           ( Save )
```

Dietary and allergen tags are `aria-pressed` pill toggles from a fixed
vocabulary, never free text — free text here is what makes an allergen filter
lie. The vocabulary lives in `lib/dietary.ts`, which already owns it.

A price edit shows the old value beside the field until save: `€4.20 → €4.50`.
Prices are the field people fat-finger, and the diff is already going into the
audit row, so showing it before the write costs nothing.

Saving revalidates `/`. `app/page.tsx` is on `revalidate = 30` so it would
self-heal within half a minute, but a manager who changes a price and reloads
the storefront expects to see it.

---

## 9. Receipts

### 9.1 The document

`order_receipt(p_token uuid) returns jsonb` — `order_by_token()` plus
`day_number`, `settled_as`, `tax_total`, per-line `vat_rate`, `discount_total`,
`discount_reason`.

Shop details come from `lib/shop.ts`, a plain module of constants — name,
address, VAT registration number from env. One shop, and CLAUDE.md already
hardcodes the address. `shop.settings` exists in `staff_can()` for the day a
settings table earns its keep; today it would be a one-row table read on every
receipt.

### 9.2 `/order/[token]/receipt`

Deliberately not styled like the rest of the storefront. It is a document.

```
  KROMA COFFEE & BAKEHOUSE
  STR. UNIVERSITĂȚII 12, CLUJ-NAPOCA
  VAT RO00000000

  ── hairline ─────────────────
  #042              2 SEP 2026
  CASH                   08:14
  ── hairline ─────────────────
  2 × CORTADO           €8.40
      OAT MILK
  1 × CINNAMON BUN      €4.80
  ── hairline ─────────────────
  SUBTOTAL             €13.20
  DISCOUNT             −€1.00
  TOTAL                €12.20
  INCL. VAT 11%         €1.21
  ── hairline ─────────────────
  NOT A FISCAL RECEIPT.
  ASK AT THE BAR FOR A BON FISCAL.
```

Everything mono, `max-w-[380px]`, centred. `@media print` drops to `58mm` width
with `@page { margin: 4mm }` so it comes out of a thermal printer correctly, and
strips the header, footer and the print button. The honesty line at the bottom
is not fine print — it is set at normal metadata weight, because a customer who
needs a fiscal receipt needs to know to ask *now*, at the counter.

Entry points: a `RECEIPT` link on `/order/[token]` once the status is `paid` or
beyond, and on every row of `/account/orders`.

### 9.3 Email

Sent once, on the transition into `paid` — from `placeOrderFromSession()` for
card orders and from `advanceOrderAction()` for counter orders.

Transport is a single `fetch` POST to the Resend API. No SDK: it is one endpoint
with a JSON body, and an SDK here would be 40 KB to avoid nine lines.

The address: `auth.users.email` for signed-in customers; for guests, a new
optional field at checkout, stored on `orders.receipt_email`.

```
  NAME FOR THE ORDER
  Ana___________________________

  EMAIL FOR THE RECEIPT
  ana@example.com_______________     ← OPTIONAL, mono placeholder
```

Placed directly under the name field, `type="email"`, `LABEL` styling, with the
mono note `Optional — for the receipt and a ping when it's ready.` This one
field earns its place twice: it is also the notification fallback for iOS
(§10). Signed-in customers do not see it; their account already has an address.

`orders.receipt_sent_at timestamptz` makes the send idempotent under webhook
retries. A failed send logs and does not fail the order — the receipt link is
the source of truth and the email is a convenience.

---

## 10. Ready notifications

### 10.1 Model

```sql
create table order_push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique (order_id, endpoint)
);
```

Subscriptions are scoped to **one order**, not to a person. That is the whole
design decision, and it removes an entire feature's worth of work: no preference
screen, no unsubscribe flow, no stale endpoints accumulating for a customer who
has not visited since March. The row dies with the order, and the daily
`release-holds` cron already runs — one extra `delete` in it sweeps
subscriptions for orders older than a day.

`web-push` is the one new dependency. VAPID JWT signing plus AES128GCM payload
encryption is exactly the kind of crypto that should not be hand-rolled to save
a package.

### 10.2 Trigger

`advanceOrderAction()` already has the new status in hand. When it is `ready`,
it fires — push to every subscription on the order, and email if there is a
`receipt_email` and no subscription. Not from SQL: Postgres would need `pg_net`
and a queue to do what the server action does in four lines with a result it is
already holding.

### 10.3 UI

On `/order/[token]`, directly under `OrderStatus`, while the order is unsettled:

```
  ( Tell me when it's ready )          ← border pill, h-9, mono 10px
```

After granting: the button is replaced by `We'll ping you.` in `badge-live`.
After denying: `Notifications are off in this browser. This page updates on its
own.` — honest, and the 15-second poll behind it is real.

Where Web Push is unavailable — iOS Safari outside a home-screen app, which is a
large share of the people standing in a café — the button reads
`Email me when it's ready` instead and posts an address against the same order.
Same position, same weight, one working path on every device.

---

## 11. Discounts and comps

### 11.1 Model

`orders` gains `discount_total numeric(8,2) not null default 0` and
`discount_reason text`.

`discount_order(p_order_id uuid, p_actor uuid, p_kind text, p_value numeric,
p_reason text, p_station uuid default null) returns jsonb`

* Guarded by the existing `order.discount` — manager and owner.
* `p_kind` is `'percent'` (1–100), `'amount'` (euros), or `'comp'` (the lot).
* `p_reason` is **required**, minimum three characters. The reason is the entire
  internal control; a discount without one is indistinguishable from theft.
* Takes `for update` on the order, refuses on `cancelled` and `refunded`.
* **Replaces** rather than stacks: a second call sets the total discount, it does
  not add to it. Stacking is how a 10% comes out as 100% after four taps.
* Recomputes `total = subtotal − discount_total` and prorates `tax_total` by
  `total / subtotal`.
* Returns `refund_owed` in euros when the order was already settled online, so
  the action can call `stripe.refunds.create({ amount })` — the same shape
  `advance_order()` already returns for a void, handled by the same caller.

### 11.2 UI

In `OrderDetail`, in the existing action row, manager-only, between the forward
buttons and the red settle buttons:

```
  ( Start )  ( Step back )  ( Discount )  ( Void — … )
```

`Discount` is a bordered `accent-primary` pill — louder than "step back",
quieter than a void. It opens a sheet, not a modal:

```
  DISCOUNT #042

  ( 10% )  ( 20% )  ( 50% )  ( COMP )     ← aria-pressed, layoutId fill
  OR AN AMOUNT   € _____

  WHY
  Spilled it_____________________________  ← required, 3 char min

  TAKES €14.60 TO €13.14                   ← live, numberTransition
                                              accent-primary

           ( Apply )
```

The before/after line updates as pills are pressed, through `numberTransition`
in mono. `Apply` stays disabled until a reason is typed — disabled with the mono
note `A reason, so the ledger means something.` underneath, rather than silently
inert.

On the board, a discounted order carries one extra mono line on its row:

```
  #042  ANA                              €13.14
  2 CORTADO / 1 CINNAMON BUN
  −€1.46 / SPILLED IT                            ← accent-primary, 10px
```

A comp shows `COMPED / SPILLED IT` instead of an amount. Both read at a glance
from across the bar, which is the point: a comped order that looks identical to
a paid one is how a shop loses money quietly.

---

## 12. Order of implementation

1. **Service day** — everything else scopes to it, and it is the only P0 whose
   absence is already corrupting data every night.
2. **VAT** — small, and every downstream feature snapshots it. Doing receipts
   first would mean writing them twice.
3. **Tender + Z-report** — needs the day and the VAT breakdown.
4. **Menu management** — independent, but `par_stock` arrives in (1) and has no
   editor until this ships.
5. **Receipts** — needs VAT and `day_number`.
6. **Discounts** — needs VAT, to prorate.
7. **Notifications** — fully independent; last, because it is the only one of
   the seven the shop can trade without.

## 13. Risks

* **`create_order()` starts refusing when the shop is closed.** Every existing
  SQL test that calls it fails until its fixture opens a day. This is the single
  most disruptive line in the plan, and it is deliberate.
* **`advance_order()` gains a required argument on one transition.** A counter
  order cannot be marked paid without a tender. Any caller not updated raises.
* **Backfilling `day_number` and `tax_total`** rewrites historical rows. It is
  correct to do, and it must happen in the same transaction as the column adds.
* **The receipt is not a fiscal receipt.** If the copy ever stops saying so, the
  shop has a compliance problem the code will not surface.
