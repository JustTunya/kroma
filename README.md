# KROMA Coffee & Bakehouse

A full order-ahead storefront and back-of-house system for a fictional
specialty coffee shop, built as a portfolio piece. Minimalist Nordic-Japanese
storefront on the front end, a real Kitchen Display / order board / stock /
close-of-day system on the back end — see `CLAUDE.md` for the full brand and
system spec.

**This is a demo project.** No real business, no real payments in production
(Stripe runs in test mode), no real delivery. It exists to show a complete
ordering flow end to end: browse → customize → pay → track → a barista
actually preparing and calling the order.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Supabase (Postgres, Auth,
RLS) · Stripe Checkout · Web Push · Framer Motion.

## Trying it live

The storefront opens itself automatically every day (a cron job calls the
same `open_service` RPC a barista would tap on the iPad — see
`app/api/cron/release-holds/route.ts`), so there is always a live menu to
order from. Card payments run through Stripe **test mode** — use
[`4242 4242 4242 4242`](https://docs.stripe.com/testing), any future
expiry, any CVC.

`/dashboard` is the staff side (order board, kitchen display, stock, close of
day) and is gated behind a real account plus a 4-digit PIN. That PIN isn't
published — it's a real write-access credential against live demo data, not
a toy. To see the dashboard, run the project locally instead (below); the
local seed ships with its own throwaway PIN.

## Running locally

```bash
pnpm install
supabase start        # local Postgres + Auth, seeded from supabase/seed.sql
pnpm dev
```

Copy `.env.local.example` → `.env.local` (or ask for one) and fill in:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | `supabase start` prints these for local dev |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe dashboard, test mode; `stripe listen` for the webhook secret |
| `CRON_SECRET` | any string — only checked against the `Authorization` header on `/api/cron/*` |
| `STAFF_SESSION_SECRET` | any string — signs the staff PIN-unlock cookie |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_SUBJECT` | `npx web-push generate-vapid-keys`, for order-ready push notifications |
| `NEXT_PUBLIC_IMAGEKIT_ID` | optional — falls back to the Unsplash pool in `lib/menu-images.ts` |

`supabase db reset` re-runs every migration plus `supabase/seed.sql`, which
seeds the menu **and** a local-only staff account:

- Dashboard PIN: **`1234`** (owner role — every screen unlocked)
- The shop still has to be opened once per session: `/dashboard` walks you
  through it (par-stock counts, then Open) the same way a real morning would.

## Layout of the codebase

- `app/page.tsx` + `components/storefront/*` — the storefront, the reference
  implementation for every visual pattern (see `CLAUDE.md`)
- `app/checkout`, `app/order/[token]` — cart → Stripe → order tracking
- `app/dashboard` — order board, kitchen display, stock, numbers, close of day
- `supabase/migrations` — schema, RPCs, and RLS policies (the actual business
  logic lives here, not in the app layer)

## What's simulated

- Payments: Stripe test mode, no real charges.
- Push notifications: real Web Push, but there's no phone number/SMS path.
- "Roasting" and sourcing copy on the storefront is flavor text, not a real
  supply chain.
