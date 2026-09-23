# M2 — Public demo staff mode

Implements ROADMAP.md M2 option A. Goal: a reviewer who never touches a
terminal can reach and use the staff dashboard (KDS, stock, close of day)
against a shared sandbox account, safe to trash, that heals itself nightly —
plus a `pnpm seed:demo` script so the dashboard isn't empty the first time
anyone looks at it.

The whole deployed app is already the demo (no real payments, no
multi-shop — see ROADMAP's "Explicitly out of scope"). "Demo shop" below
just means the one shop this app runs, in its always-demo deployment.

## 1. Demo staff account & login

- Migration: `alter table staff add column is_demo boolean not null default false;`
- One fixed Supabase Auth account, credentials from env (published in the UI
  and README, not secret — that's the point of a sandbox account):
  `DEMO_STAFF_EMAIL`, `DEMO_STAFF_PASSWORD`, `DEMO_STAFF_PIN`.
- That Auth user is linked to a `staff` row: `role = 'owner'`,
  `kind = 'person'`, `is_demo = true`, `pin_hash = crypt(DEMO_STAFF_PIN, ...)`.
  Owner role so the demo can show every screen (close of day included).
- Login page (wherever `/auth/sign-in` renders today) gets a "Try the staff
  side — PIN {DEMO_STAFF_PIN}" link. Its server action calls
  `auth.signInWithPassword({ email: DEMO_STAFF_EMAIL, password: DEMO_STAFF_PASSWORD })`
  through the existing SSR Supabase client (same cookie plumbing as a real
  sign-in), then redirects to `/dashboard`. The real PIN pad takes over from
  there — no new dashboard code path, this is the genuine flow with known
  credentials.
- Every visitor authenticates as the same Auth user. That is the intended
  "shared sandbox," not a bug — matches "against a demo shop that is safe to
  trash" in ROADMAP.md.

## 2. Abuse capping

`staff_can(role, action)` is the single permissions authority (per its own
migration comments) but takes no actor identity, so it can't see `is_demo`.
Rather than widen that signature and touch every one of its ~10 call sites,
add one explicit guard at just the 5 sites that gate `'menu.edit'` or
`'order.refund'`:

- `menu_item_upsert`, `menu_item_delete`, `menu_reorder`,
  `menu_category_upsert` (all gate `'menu.edit'`)
- the refund branch of `advance_order` (gates `'order.refund'`)

Each gets, right after the existing `staff_can` check:

```sql
if v_actor.is_demo then
  raise exception 'Shared sandbox — refunds and menu edits are disabled here.'
    using errcode = 'P0001';
end if;
```

One migration, `create or replace function` for each — this codebase's
existing pattern for small RPC tweaks (see `20260822090400_rpc_optional_args.sql`).
Everything else (advancing orders through the board, 86'ing stock, notes,
opening/closing service) stays usable — that's the material the roadmap
calls "the most impressive half of the project."

## 3. Nightly reset

New RPC, `reset_demo_day()`, `security definer`, `revoke all from public,
anon, authenticated` (service-role only — it's a blunt instrument, never
callable from the client). Called from
`app/api/cron/release-holds/route.ts`, **before** the cron's existing
"open the shop" step:

1. Delete today's orders (`placed_at` on today's shop-local calendar day, via
   the existing `shop_tz()` helper). Cascades handle `order_items`,
   `card_redemptions`, `order_push_subscriptions`.
2. Delete today's `service_days` row if one exists, so the cron's
   subsequent `open_service()` call inserts a fresh one instead of finding
   the day already open (or worse, already closed).
3. Clear any PIN lockout on the demo staff row:
   `update staff set failed_pins = 0, locked_until = null where is_demo`.
4. Log one `staff_events` row (`action = 'demo.reset'`, `staff_id` = the
   demo staff id) for auditability.

Older days (anything seeded by `pnpm seed:demo`, or genuinely from a prior
day) are untouched — the reset clears today's mess, not the demo's history.
That is the one assumption flagged to and confirmed by the project owner:
"vandalism heals" means today resets, not a full nightly wipe.

No feature flag gating this — the whole deployment is the demo, so there is
no "real" mode to protect.

## 4. `pnpm seed:demo`

One script, `scripts/seed-demo.mjs` — plain Node ESM (no new devDependency;
`@supabase/supabase-js` is already a dependency), driven by
`SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` from the
environment it's run in (local `.env.local` for dev, or the hosted
project's values for a one-time production backfill). Idempotent: safe to
run more than once.

**Setup (skipped if it already exists):**
- Create the demo staff Auth user via `auth.admin.createUser` and link/
  upsert its `staff` row (`is_demo = true`, PIN from `DEMO_STAFF_PIN`).

**History (skipped if the `orders` table is already non-empty — this script
is for bootstrapping a demo, not for continuous reseeding):**
- ~10 fake customer Auth users + `profiles` rows + a handful of
  `favourites` each, so punch cards and "past orders" show real repeat
  customers, not one-off strangers.
- ~30 days of backdated orders, inserted directly (bypassing
  `create_order`/`advance_order`, which both stamp `now()` — normal for a
  seed script that needs to backdate). Shape aimed at "realistic," not
  exact:
  - Volume curve: weekday espresso-bar rush 07:00–09:00, lunch bump
    12:00–13:00, weekend brunch peak 09:00–12:00, quiet afternoons.
  - Item mix weighted toward espresso-bar drinks over kitchen items,
    matching a real coffee shop's basket composition.
  - Mix of guest orders (`user_id null`, `customer_name` set) and
    logged-in fake-customer orders, with some customers reordering across
    days (punch card realism).
  - Small percentage cancelled/refunded, rest `collected`.
  - `settled_as` split across cash/card/online.
  - Punch-card `card_redemptions` rows generated whenever a repeat
    customer's cumulative punches cross the 10-punch threshold.
- One `service_days` row per backfilled day, closed via the real
  `close_service`/`service_report` RPCs (reuses the actual Z-report
  math instead of re-deriving it) so close-of-day history is internally
  consistent, not just plausible-looking numbers.
- Today is left alone by the script (the nightly reset/open-shop cron
  handles it) — except locally, where seeding a few in-flight orders for
  the current day makes the KDS board demonstrable without waiting for a
  cron.

## Files touched

- `supabase/migrations/<ts>_demo_staff_mode.sql` — `is_demo` column, the 5
  RPC guards, `reset_demo_day()`.
- `app/api/cron/release-holds/route.ts` — call `reset_demo_day()` first.
- Login page + a new server action for demo sign-in.
- `scripts/seed-demo.mjs` (new), `package.json` (`"seed:demo"` script).
- `.env.local.example`, `README.md` — new env vars, published demo
  credentials, `pnpm seed:demo` instructions.
- `ROADMAP.md` — tick M2's boxes.

## Explicitly not doing

- No rate-limiting middleware/dependency — the demo cap is a hard block on
  two actions, not a request-rate throttle (there's no existing
  infrastructure for that in this codebase, and the roadmap's ask —
  "rate-limit or **disable**" — is satisfied by disabling).
- No UI-side disabling of the now-blocked buttons (greying out "Delete" /
  "Refund" for the demo actor). Server rejects with a clear on-brand error
  message; that's enough for a demo. Flag if a nicer disabled state is
  wanted later.
- No per-visitor demo session isolation — one shared account, as specified.
