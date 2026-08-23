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

## 2. Color Palette & Semantic Tokens

Defined in `tailwind.config.ts` as flat Tailwind color names — use `bg-surface-canvas`,
`text-text-secondary`, `border-hairline` directly. Avoid cold blues, neon accents, and
pure black (`#000000`).

**Do not use the shadcn semantic tokens** (`bg-background`, `text-muted-foreground`,
`bg-primary`, …) in storefront UI. `app/globals.css` still carries the default shadcn
neutral scale for `components/ui/*` primitives, but it is a grey palette and will read
cold next to the KROMA warm neutrals. Storefront code uses the tokens below only.

### Palette Definitions

| Token | Hex Value | Role & Usage |
| :--- | :--- | :--- |
| `surface-canvas` | `#F8F6F0` | Warm Alabaster - primary page background; also the *text* color on dark surfaces |
| `surface-card` | `#FFFFFF` | Pure White - modals, sheets, elevated elements, text on `accent-primary` |
| `surface-muted` | `#EFECE4` | Stone tint - image placeholders behind loading photography, inactive pills |
| `hairline` | `#DCD6CA` | **Primary structural rule.** Section dividers, list row dividers, sticky-bar borders, the `/` glyph between metadata |
| `border-subtle` | `#E4DFD5` | Softer border for image frames and enclosed containers |
| `border-focus` | `#1A1816` | `focus-visible` outline color |
| `text-primary` | `#1A1816` | Deep Roasted Espresso - headings, prices; **also used as a dark surface** (`bg-text-primary` on hero + footer) |
| `text-secondary` | `#635E59` | Muted Ash - descriptions, ledger entries, body copy |
| `text-tertiary` | `#9B948C` | Warm Grey - metadata, spec lines, inactive nav pills, sold-out names |
| `accent-primary` | `#C85A2A` | Burnt Terracotta - eyebrows, live status, `+ Add` affordance, primary CTA fill |
| `accent-hover` | `#AD4B20` | Deep Terracotta - hover/pressed on filled CTAs |
| `accent-subtle` | `#F8EFEB` | Soft Peach - status pill backgrounds (often at low opacity over photography) |
| `badge-live` | `#2D6A4F` | Forest Green - live queue status, positive kitchen status |
| `badge-alert` | `#B93826` | Deep Rust - "gone for today", "only N left", any depleted-batch text |

### Inverted Surfaces (hero, footer, KDS)

Dark areas are not a theme toggle — they are surfaces. Compose them from:
`bg-text-primary` + `text-surface-canvas`, with `border-kds-border` for rules and
`text-kds-text-secondary` for muted labels.

* `kds-canvas`: `#141211` · `kds-surface`: `#1E1B19` · `kds-border`: `#2E2A27`
* `kds-text-primary`: `#F8F6F0` · `kds-text-secondary`: `#A39C94`

Use the full `kds-*` canvas for the Barista Kitchen Display (`/barista`, `/kitchen`).

### Opacity Conventions

Over photography, tint rather than fill: `bg-surface-canvas/85` (scrolled bars),
`bg-accent-subtle/20` (status pill on the hero), `text-surface-canvas/70` (hero eyebrow),
`text-surface-canvas/75` (hero body). Always pair a translucent bar with `backdrop-blur-xl`.

---

## 3. Typography System

Loaded in `app/layout.tsx` via `next/font/google`, exposed as CSS variables and mapped in
`tailwind.config.ts` to `font-serif` / `font-sans` / `font-mono`.

### Font Families
* **Display / Editorial:** `Instrument Serif` — weight **400 only**, normal + italic. `font-serif`.
* **Body / UI:** system sans-serif stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`) — the `html` default. `font-sans`. No web font loaded for this role; native OS font only.
* **Data, labels, metadata:** `JetBrains Mono`. `font-mono`.

### The Mono Rule (defining KROMA characteristic)

Monospace does far more work here than in a typical storefront. **Every label, eyebrow,
badge, nav pill, price, timestamp, spec line, and footer detail is uppercase mono with
wide tracking.** Sans is reserved almost entirely for descriptive sentences. If a piece
of text is a *label* rather than a *sentence*, it is mono-uppercase.

### Tracking Ladder (memorize — it is the system)

| Tracking | Applied to |
| :--- | :--- |
| `tracking-[0.18em]` | Eyebrows, live-status pills, footer labels, header wordmark suffix |
| `tracking-[0.16em]` | Category nav pills, footer legal row |
| `tracking-[0.14em]` | Item spec lines, stat lists, ledger entries, preview caption |
| `tracking-[0.02em]` | Prices, cart counts, footer address lines, hero body — mono set in *sentence case* |
| `tracking-[-0.02em]` | Serif headings, wordmark |
| `tracking-[-0.03em]` | Hero display only |

### Size & Weight Reference (actual page values)

| Role | Family | Size | Weight | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Hero display | Serif | `clamp(56px, 10vw, 148px)` / `leading-[0.92]` | 400 | `max-w-[16ch]`, one accent word in `<em>` italic |
| Section heading | Serif | `clamp(32px, 4vw, 52px)` / `leading-[1.05]` | 400 | `max-w-[14ch]` |
| Menu item name | Serif | `clamp(28px, 3.2vw, 44px)` / `leading-[1.05]` | 400 | |
| Wordmark | Serif | `26px` / `leading-none` | 400 | |
| Body copy | Sans | `15px`-`16px` / `1.55`-`1.6` | 400 | `max-w-md` / `max-w-lg` |
| Price / count | Mono | `15px` / `12px` | 500 | `tabular-nums`, `€` prefix, always `.toFixed(2)` |
| Metadata / spec | Mono | `11px` | 500 | uppercase |
| Micro label / eyebrow | Mono | `10px` | 500-600 | uppercase |

**Fluid type via `clamp()` is the default for anything display-sized** — no breakpoint
step-downs on headings.

---

## 4. Radii, Spacing & Elevation

### Border Radius — what the page actually uses

The landing page is deliberately **near-square**. Only three radii appear:

* `rounded-full` — nav pills, status pills, the cart button, live dots. All pill-shaped controls.
* `rounded-sm` (6px) — small photo thumbnails (80px item images).
* `rounded-lg` (16px) — the large sticky preview image frame.

`radius-md` (10px, form inputs/dropdowns) and `radius-xl` (24px, modals, bottom sheets)
stay reserved for the checkout/customizer surfaces that don't exist yet. Do not introduce
new radii; do not round section blocks or list rows at all.

### Borders — the hairline system

Structure comes from single-pixel rules, not from cards or shadows.

* Every major section is separated by `border-y border-hairline` / `border-t border-hairline`.
* Lists use `divide-y divide-hairline border-y border-hairline` — never bordered cards in a grid.
* Column splits use `md:border-l border-hairline` rather than a gap.
* Sticky bars carry `border-b border-hairline` **only once scrolled**; over the hero they are `border-transparent`.
* `border-subtle` is for enclosed image frames; `hairline` for everything structural.

### Spacing Scale

**Page gutter (invariant — apply to every full-width block):**
`px-5 sm:px-10 lg:px-14`

**Vertical rhythm:**
* Menu section: `pt-12 pb-24 lg:pt-20 lg:pb-32`
* Editorial section: `py-16 lg:py-24`
* List row: `py-7 sm:py-9`
* Footer: `pt-16 pb-14 lg:pt-24`
* Fixed bar height: `h-16` (header), `h-12` (ledger marquee), `h-9`/`h-10` (pills, cart button)

**Within a block:** `mt-2.5` (desc after title) → `mt-4`/`mt-5` (meta) → `mt-6`/`mt-7`
(paragraph after heading) → `mt-10` (stat list). Big jumps, no medium ones.

### Elevation

Shadows are near-invisible by design and used **twice on the whole page**. Prefer a border.

* `shadow-card`: `0 1px 3px rgba(26,24,22,0.04), 0 6px 16px rgba(26,24,22,0.03)` — image frames only.
* `shadow-float`: `0 8px 30px rgba(26,24,22,0.08)` — floating pills over photography, sticky cart pill, bottom drawers.

---

## 5. Layout System

**Sticky stack** (order matters, offsets are hard-coupled):

| Element | Position | Notes |
| :--- | :--- | :--- |
| `StorefrontHeader` | `fixed top-0 z-50`, `h-16` | Overlays the hero — the hero is *not* offset for it |
| `CategoryNav` | `sticky top-16 z-40` | Parks exactly under the header |
| Menu preview panel | `sticky top-32` | Clears both bars |

A sticky rail is wrapped in a `<div>` around **only** the content it should stick over, so
it releases when that section ends.

**Hero:** `h-dvh`, `items-end` — content sits at the bottom-left, never centered.

**Menu:** two columns on desktop, `lg:grid-cols-[minmax(0,1fr)_360px] gap-12 lg:gap-20`.
Left: the full-width editorial list. Right: a fixed-width `aspect-4/5` sticky preview that
swaps on row hover/focus, captioned in mono-uppercase. Below `lg`, the preview panel is
hidden entirely and each row shows an inline `size-20` thumbnail instead.

**Editorial sections:** `md:grid-cols-2` split by a border, not a gap.

**Full-bleed rule:** sections span the viewport edge-to-edge and manage their own gutters.
There is no centered `max-w-7xl` container anywhere. Line length is constrained on the
*text element* (`max-w-md`, `max-w-lg`, `max-w-[14ch]`), not on the layout.

**Aspect ratios:** `4/5` for the desktop preview frame, `1/1` (`size-20`) for row
thumbnails, `2560/1440` for the hero plate. Product photography is portrait-leaning here,
not the `4:3` of a conventional grid.

---

## 6. Imagery & Visual Assets

* **Photography Style:** high-contrast natural light, warm wooden textures, matte ceramics, linen, warm beige stone. Soft morning daylight.
* **Composition:** overhead flat-lay or 45° close-up showing craft — latte microfoam, glossy lamination, clear ice in cold brew.
* **Containers:** always `overflow-hidden` with a `bg-surface-muted` fallback fill so nothing jumps while loading. Frames get `border border-border-subtle rounded-lg`; thumbnails get `rounded-sm`.
* **Delivery:** `next/image` with `fill` + explicit `sizes` and `object-cover`. `menu_items.image_url` wins; otherwise `lib/menu-images.ts` serves a category-keyed Unsplash pool rotated by list index so neighbouring rows never repeat a frame. Remote host allowlisted in `next.config.ts`.
* **Decorative images take `alt=""`** — the item name is already adjacent text.
* **Hero plate:** `public/kroma_bg.webp` + `public/kroma_bg_depth.webp` (grayscale depth map generated by `scripts/depth.py`). See §8.

---

## 7. Component Patterns

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

## 8. Hero Parallax

The hero is a WebGL depth-map parallax (`HeroParallax.tsx`): one photo plus a grayscale
depth map, with a fragment shader that displaces each pixel's UV along the cursor vector in
proportion to its depth. Near objects lead, far objects trail, so the room reads as layers.

* Tuning constants live at the top of the file: `STRENGTH_X 0.03`, `STRENGTH_Y 0.018`,
  `PIVOT 0.45` (depth that stays put), `ZOOM 1.06` (oversample so displaced edges never
  expose the texture border), `EASE 0.045` (cursor lag — heavy, so the room has mass).
* 8-step fixed-point iteration on the depth lookup kills smearing at hard depth edges.
* DPR capped at 2; redraws only when the cursor moved or the canvas resized.
* **Fallback is mandatory:** no WebGL, load failure, or `useReducedMotion()` → a plain
  `<img>` with identical framing. Never leave a blank canvas.
* Entrance: `opacity 0→1` over 1.1s plus `scale 1.06→1` over 2.4s on `[0.16, 1, 0.3, 1]`.
* Two scrim gradients sit above it — vertical `from-text-primary/95 via-/45 to-/5` and
  horizontal `from-text-primary/80 via-/25 to-transparent` — so type stays legible over any frame.

---

## 9. Animation & Motion (Framer Motion)

All animation is Framer Motion. Tokens live in `lib/motion.ts` (interaction) and
`lib/reveal.ts` (entrance) — **import them, never inline new spring or easing values.**

### Two families, never mixed

**Springs — things the user pushed** (`lib/motion.ts`):
* `spring` — structural: layout morphs, `layoutId` shared elements, row reflow, hover offsets, modals, drawers. `{ type: "spring", stiffness: 300, damping: 30, mass: 1 }`
* `pressSpring` — press feedback. `{ type: "spring", stiffness: 400, damping: 25 }`
* `numberTransition` — dynamic numbers: `initial { y: -10, opacity: 0 } / animate { y: 0, opacity: 1 } / exit { y: 10, opacity: 0 }`, wrapped in `AnimatePresence mode="popLayout"` keyed on the value.

**Eases — arrivals the user did not trigger** (`lib/reveal.ts`):
* `glide` — `{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }` (expo-out). Every entrance.
* `lineReveal` — `y: "110%" → "0%"` inside a `overflow-hidden` clip with `pb-[0.18em]` for descenders. Display lines only.
* `rise` — `{ opacity: 0, y: 20 } → { opacity: 1, y: 0 }`. Content blocks.
* `inView` — `{ once: true, margin: "0px 0px -12% 0px" }`. Shared `whileInView` viewport config.

### Choreography

* Hero lines are staggered by explicit delays: `0.1` eyebrow → `0.2` / `0.32` display lines → `0.5` body.
* Scroll-in blocks use `staggerChildren: 0.08` on the parent instead of per-child delays.
* Press: `whileTap={{ scale: 0.98 }}` on buttons and pills, `0.995` on large row-sized targets.
* Continuous ambience: live dot `opacity [1, 0.25, 1]` over 2.4s `easeInOut` infinite; ledger marquee 70s linear infinite.
* Exits are faster than entrances — filtered rows leave on `{ duration: 0.12, ease: "easeOut" }` so a reflow isn't gated behind a spring.
* Color-only state changes (header inversion, `+ Add` reveal) use plain CSS
  `transition-colors` / `transition-opacity duration-300`. Framer Motion is for transform
  and structure; CSS handles paint.

### Reduced motion — non-negotiable

Every ambient or decorative animation checks `useReducedMotion()` and degrades to a static,
still-usable state: parallax → still image, marquee → horizontally scrollable strip,
pulse → steady dot, hero reveal → `initial={false}`.

### Hardware acceleration constraints

1. Animate **only** `opacity` and `transform` (`x`, `y`, `scale`, `rotate`).
2. Never animate `width`, `height`, `margin`, `padding`, `top`, `left`, or `box-shadow`.
3. Never mix `duration` with a `spring` transition — it breaks interruptibility.
4. With `layout` / `layoutId`, let Framer Motion fake the dimension change; do not add CSS transitions on top.
5. Use `layout="position"` (not full `layout`) on list rows so only the offset animates.

---

## 10. Interaction & State

* **Cart & customization drawers:** slide-over at all breakpoints, full-height, anchored right, no radius. `AnimatePresence`, `x: "100%" → 0` on `spring`, over a backdrop tweened `opacity 0 → 1` at `duration: 0.2` (`bg-text-primary/25`).
* **Price feedback:** any modifier change re-renders the total through `numberTransition` in mono.
* **Empty state:** a single mono sentence between two hairlines (`border-y border-hairline py-10`) — never an illustration or an icon.
* **Button states:** default CTA `bg-accent-primary text-surface-card`, hover `accent-hover`, press `scale-98`, disabled `bg-surface-muted text-text-tertiary border-border-subtle`.
* Secondary/idle controls over the canvas use `bg-surface-muted text-text-primary`; over photography, `bg-surface-canvas/15 backdrop-blur-sm`.

---

## 11. Accessibility

Non-negotiable, and already consistent across the page — match it.

* **Focus:** `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus` (offset `4` on large row targets). Never remove outlines.
* Every icon-only or ambiguous control carries a descriptive `aria-label` that includes state and price: `Add Cortado to order, €4.20` / `Cortado — gone for today`.
* Sections carry `aria-label`; live regions use `role="status"`.
* Toggle groups use `aria-pressed`; decorative spans, glyph separators, gradients, and the parallax canvas take `aria-hidden`.
* Keyboard parity with hover: anything reachable by `whileHover` also responds to `whileFocus` / `onFocus` (the preview panel swaps on both).
* `/` separators and repeated marquee copies are always `aria-hidden` so screen readers hear the content once.

---

## 12. Stack Notes

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
