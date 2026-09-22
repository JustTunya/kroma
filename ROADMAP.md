# KROMA — Roadmap to a Finished Portfolio Piece

**Definition of done:** a hiring manager or client can open one link, understand what
this is in 30 seconds, click through the whole customer + staff flow without me
present, and nothing looks broken. It is a demo, not a business — so anything that
only matters at real-shop scale is explicitly out of scope (bottom of this file).

The app itself is largely built (storefront, checkout, order tracking, accounts +
punch card, staff dashboard, 13 SQL test files, unit tests). What's left is mostly
**polish, reachability, and presentation**, not features.

Order matters: M1 → M2 first, they gate everything else. Each milestone is small
enough for a day or two.

---

## M1 — Land the in-flight work

- [x] Finish and commit the uncommitted `components/dashboard/PinPad.tsx` change.
- [x] Finish the storefront luxury redesign (`docs/superpowers/plans/2026-09-21-storefront-luxury-redesign.md`); tick off every task or cut the ones not worth it.
- [x] `pnpm lint` and `npx tsc --noEmit` clean; `pnpm build` passes.
- [ ] Merge `feat/redesign` → `master`. Delete dead branches.

**Exit:** `master` builds clean and is what's deployed.

## M2 — A reviewer can actually see the staff side

This is the biggest gap. The README says the dashboard PIN is deliberately unpublished,
so the most impressive half of the project (KDS, stock, close of day) is invisible to
anyone who doesn't clone and run it locally. Nobody will.

Pick one (recommended: **A**, with **B** as backup):

- [x] **A. Public demo staff mode.** A "Try the staff side" link on the login page that signs into a sandbox staff account with a published PIN, against a demo shop that is safe to trash. Add a nightly reset (extend the existing cron) so vandalism heals itself.
- [ ] **B. Recorded walkthrough.** 60–90 s screen capture: place an order on phone → it appears on the board → barista calls it → push notification / status page flips → close of day. Embed in README and portfolio page.
- [x] Cap abuse on the demo: rate-limit or disable destructive actions (menu delete, refunds) for the demo account.

**Exit:** someone who never touches a terminal can see the staff dashboard working.

## M3 — Verify the live demo end to end

Manual pass on the deployed site, on a real phone and a desktop. Fix what breaks.

- [ ] Guest flow: browse → filter → customize a drink → cart → Stripe test card `4242…` → order page → receipt.
- [ ] Sign-up email arrives and the confirm link works (production Supabase Auth redirect URLs, email template, sender).
- [ ] Google OAuth works on the production domain (or remove the button).
- [ ] Punch card, "The Usual", reorder, settings/password change.
- [ ] Web Push: subscribe, receive "ready" notification. iOS needs the PWA installed — confirm or document the limitation.
- [ ] Stripe webhook is registered against the production URL and flips order state.
- [ ] Cron actually opens the shop each day (Vercel cron logs). **Empty-menu failure mode:** if the shop isn't open, does a visitor see a dead site? Make the closed state look intentional, or keep the shop open for the demo.
- [ ] Storefront `menu.json` fallback still renders when Supabase is unreachable.
- [ ] Supabase free-tier project won't be paused for inactivity — set a keep-alive ping (cron hitting a cheap query) or note it.
- [ ] Remove secrets/test junk: confirm no keys in git history, `.env.local` is ignored.

**Exit:** a full run-through with zero console errors and zero dead ends.

## M4 — Responsive, accessibility, performance pass

Recruiters open portfolio links on phones.

- [ ] Check 375 / 768 / 1440 px on: storefront, cart, checkout, order page, account, dashboard board.
- [ ] Run Lighthouse on `/`, `/checkout`, `/order/[token]`. Targets: Performance ≥ 90 on mobile, Accessibility ≥ 95, no CLS from the hero. The WebGL hero + framer-motion is the likely cost — lazy-load the shader, size images via ImageKit.
- [ ] Keyboard-only run of the ordering flow; visible focus everywhere; drawers trap and restore focus.
- [ ] `prefers-reduced-motion` respected (the README claims it — verify it).
- [ ] Copy audit against `CLAUDE.md` §1: no "Sold out", no exclamation marks, no "No results found". Grep for them.
- [ ] Empty/error states exist for: empty cart, unknown order token, failed payment, offline board (`app/error.tsx`, `not-found.tsx` are present — check they're on-brand).
- [ ] Favicon, `manifest.ts`, apple icon, and OG/Twitter share image set, so the link previews well when pasted into LinkedIn or a resume.
- [ ] `<title>` and meta description per route.

**Exit:** Lighthouse screenshots you're happy to show; no layout breakage on a phone.

## M5 — Prove the code is sound

Cheap credibility for anyone who opens the repo.

- [ ] Add a `test` script to `package.json` — the `*.test.ts` files exist in `lib/` but nothing runs them. Wire whatever runner they were written for, and confirm they pass.
- [ ] Document how to run the `supabase/tests/*.sql` pgTAP suite (`supabase test db`).
- [ ] Add a GitHub Actions workflow: install → lint → typecheck → unit tests → build. Badge in README.
- [ ] Sweep the `ponytail:` comments (`app/account/page.tsx:34`, card-redeem race in migrations, Europe/Bucharest hardcode). Keep them — they read as deliberate engineering judgment — but list the important ones in a README "Known limits" section rather than leaving them for a reader to discover.
- [ ] Run Supabase advisors (security + performance) and fix anything red: RLS on every table, no exposed service-role usage in client code.
- [ ] Confirm the Stripe webhook verifies signatures and is idempotent.

**Exit:** green CI badge; a clean `pnpm install && pnpm test && pnpm build` on a fresh clone.

## M6 — Make the repo presentable

- [ ] README: replace the badge wall's weight with **a hero screenshot/GIF at the top**, a live-demo link, and the walkthrough video from M2. Keep the feature list; trim it where it duplicates `PRODUCT.md`.
- [ ] 5–8 screenshots in `docs/screenshots/`: storefront (list + lookbook), item drawer, checkout, order tracking on mobile, account/punch card, KDS board, close of day.
- [ ] Add an architecture section: one diagram — browser → Next.js server actions → Supabase RPC/RLS → Stripe webhook → Realtime → board. Explain the "logic lives in Postgres" decision in a paragraph; it's the most interesting engineering call in the project.
- [ ] Verify the "Running locally" instructions from a **fresh clone** on a clean machine or container. Fix every step that fails; the seed-PIN + account-linking step is the likely one — consider a `pnpm seed:demo` script that does it in one command.
- [ ] Prune `docs/superpowers/`: either keep as a visible "how it was designed" trail (specs are a strength) with a short index, or move out of the main tree. Decide, don't leave it ambiguous.
- [ ] Remove `graphify-out/`, stray `tsconfig.tsbuildinfo`, and unused `public/` assets (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) if they're not referenced.
- [ ] Confirm the LICENSE choice (PolyForm Noncommercial) is what you want for a portfolio piece — it blocks reuse by employers evaluating it commercially-adjacent. Fine if intentional.
- [ ] Repo description, topics, and pinned status on GitHub.

**Exit:** the README alone sells the project in under a minute.

## M7 — Portfolio integration

- [ ] Write the case study (one page, not the README): problem, the two-sided "one shared heartbeat" idea, 3 hard problems solved (stock races at checkout, PIN-gated staff sessions over Supabase Auth, order state driven by webhooks not the client), what you'd do next.
- [ ] Portfolio card: title, one-line pitch, stack, live link, repo link, hero image.
- [ ] Short demo GIF for the card and a 30-s clip for social.
- [ ] Final smoke test from an incognito window on a phone, using only the link as it appears in the portfolio.

**Exit:** shipped. Stop touching it.

---

## Explicitly out of scope

Not needed for a demo; adding them is how projects stay "almost done" forever.

- Real payments / live Stripe keys, tax-authority fiscal compliance (already ruled out in the service-operations spec).
- Multi-shop / `shop_settings` table, multiple timezones.
- SMS notifications, gift cards, ratings, per-barista metrics, offline write queueing (all deferred in existing specs).
- Pickup-time slots (ASAP only is fine).
- Analytics/monitoring stack, error tracking service, load testing.
- Exact per-line VAT apportionment, per-unit punch accounting, RPC aggregates for the 200-order stats cap.
- i18n / Romanian translation.
- Admin user management UI beyond the current menu and staff tools.

## Suggested scope

Assuming full attention: M1 (½ day) · M2 (1–2 d) · M3 (1 d) · M4 (1–2 d) · M5 (1 d) · M6 (1–2 d) · M7 (1 d) — roughly **1.5 weeks**. If you need to ship faster, the irreducible core is **M1, M2-B, M3, M6, M7**.
