<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo@white.png">
  <source media="(prefers-color-scheme: light)" srcset="public/logo@black.png">
  <img src="public/logo@black.png" alt="KROMA" width="280">
</picture>

### Specialty Roastery &amp; Micro-Bakehouse

A full order-ahead coffee shop, built end to end — storefront, checkout, and a
real back-of-house kitchen display system. Portfolio project.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat&logo=nextdotjs&logoColor=white&labelColor=1A1816)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149ECA?style=flat&logo=react&logoColor=white&labelColor=1A1816)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white&labelColor=1A1816)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat&logo=tailwindcss&logoColor=white&labelColor=1A1816)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%7C%20Auth%20%7C%20RLS-3ECF8E?style=flat&logo=supabase&logoColor=white&labelColor=1A1816)](https://supabase.com)
[![Stripe](https://img.shields.io/badge/Stripe-Checkout-635BFF?style=flat&logo=stripe&logoColor=white&labelColor=1A1816)](https://stripe.com)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-Animation-C85A2A?style=flat&logo=framer&logoColor=white&labelColor=1A1816)](https://www.framer.com/motion/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat&logo=vercel&logoColor=white&labelColor=1A1816)](https://vercel.com)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?style=flat&logo=pnpm&logoColor=white&labelColor=1A1816)](https://pnpm.io)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-B93826?style=flat&labelColor=1A1816)](LICENSE)

</div>

---

## About

KROMA is a fictional specialty coffee shop built as a complete,
production-shaped web application — not a static mockup. It demonstrates a
real order-ahead flow: a customer browses a live daily menu, customizes a
drink, pays through Stripe, and tracks the order in real time, while staff
run the same order through an actual kitchen display, stock, and
close-of-day system on the back end.

Design is Nordic-Japanese minimalist: warm neutrals, a WebGL depth-map
parallax hero, hairline-ruled layouts, and a mono-uppercase data language for
every label and price. The full brand and interface spec lives in
[`CLAUDE.md`](CLAUDE.md).

**This is a demo project.** No real business, no real payments in production
(Stripe runs in test mode), no real delivery. It exists to show a complete
ordering flow end to end: browse → customize → pay → track → a barista
actually preparing and calling the order.

## Features

### Storefront

- **Live daily menu** — items, prices, and per-item stock counts read from
  Postgres and revalidate every 30 seconds, so a batch running low or
  selling out reflects on the site within the minute.
- **WebGL depth-map hero** — a custom fragment shader displaces the hero
  photo along a grayscale depth map in response to cursor movement, giving
  the room a sense of parallax depth. Falls back to a static image with no
  WebGL, on load failure, or when the OS requests reduced motion.
- **Editorial menu list** — full-width, hairline-divided rows (no card grid)
  with a sticky preview panel on desktop that swaps photography on hover or
  keyboard focus.
- **Category filtering** — animated pill navigation with a shared
  `layoutId` fill that slides between the active category.
- **Item customization** — a slide-over sheet for modifiers/variants with
  live, animated price recalculation.
- **Cart & checkout** — a persistent slide-over cart handing off to Stripe
  Checkout for payment.
- **Order tracking** — a shareable order page (`/order/[token]`) that
  updates as the kitchen progresses the order, backed by real Web Push
  notifications when it's ready.
- **Running day ledger** — a marquee ticker of opening hours, bake times,
  and live per-batch stock across the day.
- **Accessibility** — full keyboard parity with hover interactions, visible
  focus rings, `aria-pressed` toggle groups, labeled live regions, and
  `useReducedMotion()` fallbacks on every ambient animation.

### Staff dashboard (`/dashboard`)

Gated behind a real Supabase Auth account plus a 4-digit staff PIN.

- **Order board** — the live queue of incoming and in-progress orders.
- **Kitchen display** — a dedicated barista-facing screen for calling and
  completing orders, styled as an inverted dark surface for kitchen
  visibility.
- **Stock control** — par-stock counts, opening the shop for the day, and
  adjusting live batch quantities as items sell out.
- **Numbers** — a day-level view of orders and revenue.
- **Close of day** — the end-of-service reconciliation flow.
- **Menu management** — server actions for editing the live menu.

### Platform / infrastructure

- **Automatic daily open** — a Vercel Cron job calls the same `open_service`
  RPC a barista would tap on the iPad, so there's always a live menu without
  manual intervention.
- **Stripe webhooks** — order state is driven by verified Stripe webhook
  events, not client-reported payment status.
- **Web Push** — real VAPID-based push notifications for order-ready alerts.
- **Row Level Security** — access control is enforced in Postgres via RLS
  policies, not solely in the application layer; the actual business logic
  lives in `supabase/migrations`.
- **Graceful data fallback** — the storefront falls back to a repo-local
  `menu.json` snapshot when the database query returns nothing, so it never
  renders empty.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) (App Router), [React 19](https://react.dev) |
| Language | [TypeScript](https://www.typescriptlang.org) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com) primitives |
| Animation | [Framer Motion](https://www.framer.com/motion/), custom WebGL shader |
| Data / Auth | [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security) |
| Payments | [Stripe](https://stripe.com) Checkout + webhooks |
| Notifications | Web Push (VAPID) |
| Images | [ImageKit](https://imagekit.io), `next/image` |
| Deployment | [Vercel](https://vercel.com) (cron, functions) |
| Package manager | [pnpm](https://pnpm.io) |

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
seeds the menu **and** a local-only staff row with a known PIN (**`1234`**,
owner role). `/dashboard` is gated on a real Supabase Auth session first, so
the seed can't get you all the way in by itself — one-time setup:

1. Sign up at `/auth/sign-up` with any email, confirm it via the local
   Inbucket mail UI (`supabase status` prints its URL, usually
   `http://localhost:54324`).
2. Link that account to the seeded staff row:
   ```sql
   update staff set user_id = (select id from auth.users where email = 'you@example.com')
    where display_name = 'Demo Owner';
   ```
3. Sign in, open `/dashboard`, PIN `1234`.

The shop still has to be opened once per session — `/dashboard` walks you
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

## License

Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

The source is public so it can be read, studied, and used for personal or
educational purposes. **Commercial use — including running this as, or as
part of, an actual coffee shop or other business — is not permitted without
a separate license from the author.** Reach out if you'd like to discuss one.
