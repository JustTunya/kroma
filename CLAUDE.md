# KROMA — Brand & Interface Guide

This file is the source of truth for how KROMA looks and moves. Sections 1-4 define
the brand. Sections 5-12 describe the system as it is actually built on the landing
page (`app/page.tsx` → `components/storefront/*`). New pages replicate those patterns.

---

## 1. Brand Identity & Positioning

* **Brand Name:** KROMA Coffee & Bakehouse
* **Brand Tagline:** Specialty Roastery & Micro-Bakehouse
* **Brand Philosophy:** Minimalist, third-wave specialty coffee and slow-fermentation bakery inspired by modern Nordic-Japanese café culture. Clean lines, warm materiality, functional precision, and zero visual clutter.
* **Tone of Voice:** Warm, confident, minimal, craft-focused, direct. No corporate buzzwords or excessive hype.
* **Simulated Location / Origin:**
  * Address: Str. Universității 12, Cluj-Napoca, Romania
  * Hours: Mon-Fri 07:30-18:00 | Sat-Sun 08:30-17:00
  * Roasting Ethos: Light-to-medium Scandinavian profile, single-origin focus, seasonal crop rotation.

### Copy Rules (as written on the landing page)

The interface talks like the bakehouse, not like a store. Copy is a design element —
match it or the aesthetic breaks even when the CSS is right.

* Short declaratives, period-separated: *"Roasted Tuesday. Baked this morning. Collected at the bar."*
* Concrete numbers over adjectives: `12 kg drum`, `5 day rest`, `18 h bulk`, `4°C overnight`, `Baked 06:00`.
* Operational language for state, never e-commerce language: **"Gone for today"** not "Sold Out", **"Only 3 left"** not "Low stock", **"Nothing on the pass in this section today."** not "No results found".
* Em dash for apposition (`Brewing now — 8-12 min`), forward slash `/` for inline metadata separation.
* Never exclamation marks, never "Shop now", "Discover", "Elevate your experience".

---

## 2. Component Patterns

### Editorial list row (`MenuRow`) — the core product pattern

KROMA does **not** use a product card grid. Items are full-width rows on a hairline-divided
list, and the whole row is one `<button>`.

* Left (mobile only): `size-20 rounded-sm` thumbnail.
* Title (serif, fluid) and price (mono, tabular) on one `items-baseline justify-between` line.
* Description: sans, `text-secondary`, `max-w-lg`.
* Meta line: mono-uppercase `11px` at `tracking-[0.14em]`, parts joined by a `/` glyph colored `text-hairline`. Order is spec (origin / process / roast) → dietary tags with 12px lucide icons → stock warnings.
* Hover/focus: title, description, and meta slide `x: 10` on the shared spring; a terracotta `+ Add` fades in at the end of the meta line.

### Stock states

* `daily_stock === 0` → `disabled`, thumbnail `grayscale`, name drops to `text-tertiary`, meta line gains **"Gone for today"** in `badge-alert`, no hover motion, `cursor-default`.
* `0 < daily_stock ≤ 5` → **"Only N left"** in `badge-alert` on the meta line.
* Both are text on the existing meta line, not a chip or overlay stamp.

### Header

Transparent over the hero, then inverts at `scrollY > innerHeight * 0.7` to
`bg-surface-canvas/85 backdrop-blur-xl border-b border-hairline`. Wordmark, status pill,
and cart button all cross-fade their colors on `transition-colors duration-300`.
The status pill has a separate compact variant below `sm` (`8-12 min` alone).

### Category nav

Horizontal pill rail, `overflow-x-auto` + the `scrollbar-hide` utility from `globals.css`.
Active pill = `bg-text-primary` + `text-surface-canvas`, driven by a `layoutId="activeCategory"`
span so the fill slides between pills. Inactive = `text-text-tertiary`, no background.
Selection uses `aria-pressed`, not links.

### Ticker / marquee (`DayLedger`)

A mono-uppercase running ledger of the day between two hairlines: opening hours, bake
times, and live per-batch stock, `/`-separated. Rendered twice side by side and animated
`x: 0% → -50%` over **70s linear infinite** so the loop never shows a seam. Depleted
entries are `badge-alert`.

### Editorial note block (`CraftNotes`)

Terracotta mono eyebrow → serif heading (`max-w-[14ch]`) → sans body (`max-w-md`) →
mono-uppercase stat list, `/`-separated. Children stagger on scroll-in.

### Footer

Inverted surface (`bg-text-primary text-surface-canvas`). Three mono detail columns, then
an oversized SVG wordmark stretched edge-to-edge with `textLength="560" lengthAdjust="spacing"`
— the wordmark scales with the viewport as a graphic, not as text. Legal row beneath a
`border-kds-border` rule.

---

## 3. Stack Notes

* Next.js 16 App Router, React 19, Tailwind v4 (CSS-first `@theme` in `app/globals.css`, colors extended in `tailwind.config.ts` via `@config`).
* Data from Supabase; `app/page.tsx` sets `revalidate = 30` because batch stock moves through the morning. It falls back to repo-local `menu.json` when the query returns nothing, so the storefront always renders.
* Server component fetches → one `"use client"` boundary at `Storefront.tsx` holding filter and cart state → presentational children.
* `cn()` from `lib/utils.ts` for every conditional class.
* Prices are `number` euros, rendered `€${price.toFixed(2)}` with `tabular-nums`.
* `ponytail:` comments mark deliberate shortcuts with their upgrade path — read them before extending a file.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
