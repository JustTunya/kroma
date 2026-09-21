---
name: KROMA Coffee & Bakehouse
description: Specialty Roastery & Micro-Bakehouse
colors:
  surface-canvas: "#F8F6F0"
  surface-card: "#FFFFFF"
  surface-muted: "#EFECE4"
  border-subtle: "#E4DFD5"
  hairline: "#DCD6CA"
  border-focus: "#1A1816"
  text-primary: "#1A1816"
  text-secondary: "#635E59"
  text-tertiary: "#9B948C"
  accent-primary: "#C85A2A"
  accent-hover: "#AD4B20"
  accent-subtle: "#F8EFEB"
  badge-live: "#2D6A4F"
  badge-alert: "#B93826"
  kds-canvas: "#141211"
  kds-surface: "#1E1B19"
  kds-border: "#2E2A27"
  kds-text-primary: "#F8F6F0"
  kds-text-secondary: "#A39C94"
typography:
  display:
    fontFamily: "var(--font-instrument-serif), Instrument Serif, serif"
    fontSize: "clamp(56px, 10vw, 148px)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "var(--font-instrument-serif), Instrument Serif, serif"
    fontSize: "clamp(32px, 4vw, 52px)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "var(--font-instrument-serif), Instrument Serif, serif"
    fontSize: "clamp(28px, 3.2vw, 44px)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.14em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.full}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    padding: "10px 20px"
  nav-pill-active:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.surface-canvas}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
---

# Design System: KROMA Coffee & Bakehouse

## Overview

**Creative North Star: "The Nordic-Japanese Roastery Atelier"**

KROMA is a visual dialogue between Scandinavian light and Japanese architectural precision. It discards conventional e-commerce card grids and saturated gradients in favor of warm materiality, single-pixel hairline dividers, and the honest cadence of a morning bakehouse counter. Warm Alabaster (`#F8F6F0`) acts as the tactile paper-like canvas, contrasted against Deep Roasted Espresso (`#1A1816`) inverted surfaces and restrained strikes of Burnt Terracotta (`#C85A2A`).

Typography pairs editorial dignity with operational clarity. The display voice is carried by Instrument Serif in fluid clamp scales with delicate italic accents, while JetBrains Mono handles all data, timestamps, prices, and spec lines in uppercase with wide tracking. Layouts are flat and structured by hairlines rather than elevated cards, establishing a calm, unhurried atmosphere that honors the craft of slow-fermentation baking and light-roast coffee extraction.

**Key Characteristics:**
- Warm Alabaster canvas paired with high-contrast Espresso inverted surfaces.
- Single-pixel hairline rule system (`#DCD6CA`) replacing card grids and drop shadows.
- Wide-tracked monospace uppercase for all metadata, labels, and timestamps.
- Fluid Instrument Serif headings with dynamic spring hover responses.
- Near-square spatial discipline with rounded-full pill buttons and status indicators.

## Colors

The KROMA palette draws directly from the physical materials of the roastery: warm unbleached paper, roasted coffee beans, terracotta ceramics, and stone counters.

### Primary
- **Burnt Terracotta** (`#C85A2A`): Primary interactive accent, live queue indicators, "+ Add" hover affordance, and filled CTA backgrounds.
- **Deep Terracotta** (`#AD4B20`): Pressed and active state for Burnt Terracotta actions.
- **Soft Peach** (`#F8EFEB`): Subtle accent tint for status pills and low-opacity photo overlays.

### Neutral
- **Warm Alabaster** (`#F8F6F0`): Primary page canvas background and inverted text color on dark surfaces.
- **Pure White** (`#FFFFFF`): Elevated modal sheets, cart drawers, and text on accent buttons.
- **Stone Tint** (`#EFECE4`): Neutral placeholder fill behind loading photography and inactive pill states.
- **Stone Hairline** (`#DCD6CA`): The primary structural divider token across all rows, sections, and nav rails.
- **Subtle Border** (`#E4DFD5`): Soft border for enclosed photographic frames.
- **Deep Roasted Espresso** (`#1A1816`): Primary headings, body prices, dark surface backgrounds, and focus rings.
- **Muted Ash** (`#635E59`): Secondary descriptions, ledger body, and subtitle copy.
- **Warm Grey** (`#9B948C`): Tertiary metadata, spec lines, sold-out item labels, and inactive pill text.

### Status & Feedback
- **Forest Green** (`#2D6A4F`): Live queue operational status and active kitchen indicators.
- **Deep Rust** (`#B93826`): Depleted batch alerts ("Gone for today"), low-stock warnings ("Only N left"), and critical alerts.

### Inverted / KDS Canvas
- **KDS Obsidian Canvas** (`#141211`): Kitchen and barista display base background.
- **KDS Surface** (`#1E1B19`): Elevated order lane tiles on KDS screens.
- **KDS Border** (`#2E2A27`): Structural rules and lane dividers on dark surfaces.

### Named Rules
**The Single Accent Rule.** Burnt Terracotta is used on ≤10% of any given screen. Its rarity makes it the unequivocal call to action.
**The Inverted Surface Doctrine.** Dark surfaces are not a dark mode toggle; they are physical materials (hero plate, KDS screen, footer slab) composed with Deep Roasted Espresso backgrounds and Warm Alabaster text.

## Typography

**Display Font:** Instrument Serif (400, regular & italic)
**Body Font:** System UI Sans (`ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif`)
**Data / Label Font:** JetBrains Mono (500, monospace)

**Character:** A deliberate tension between editorial warmth (humanist serif) and laboratory precision (tabular mono). Sans-serif exists purely as an invisible bridge for descriptive sentences.

### Hierarchy
- **Display** (400, `clamp(56px, 10vw, 148px)`, `leading-[0.92]`, `tracking-[-0.03em]`): Hero statement headlines with one accent word in italic.
- **Headline** (400, `clamp(32px, 4vw, 52px)`, `leading-[1.05]`, `tracking-[-0.02em]`): Major section headings.
- **Title** (400, `clamp(28px, 3.2vw, 44px)`, `leading-[1.05]`, `tracking-[-0.02em]`): Menu row item titles.
- **Body** (400, `15px`–`16px`, `leading-[1.55]`, `tracking-normal`): Narrative paragraphs and item descriptions (constrained to `max-w-md` or `max-w-lg`).
- **Price / Counter** (500, `15px` / `12px`, `tracking-[0.02em]`, tabular-nums): Monetary amounts and cart counts, always formatted as `€X.XX`.
- **Label / Spec** (500, `11px`, `leading-tight`, `tracking-[0.14em]`, uppercase): Origin, process, roast specs, and dietary markers.
- **Eyebrow / Status** (500–600, `10px`, `leading-tight`, `tracking-[0.18em]`, uppercase): Section eyebrows, live status indicators, and ledger labels.

### Named Rules
**The Mono Rule.** Every label, badge, navigation item, spec line, timestamp, status pill, and price is uppercase JetBrains Mono with wide tracking (`0.14em`–`0.18em`). Sans-serif is forbidden on UI labels.
**The Fluid Scale Rule.** Display and headline sizes always use CSS `clamp()` rather than breakpoint-stepped font sizes.

## Layout

KROMA enforces full-bleed edge-to-edge layouts with disciplined internal gutters. Content is structured by horizontal hairlines rather than boxed grids.

### Spacing & Gutters
- **Standard Page Gutter:** `px-5 sm:px-10 lg:px-14` (invariant across all sections).
- **Section Rhythm:** `pt-12 pb-24 lg:pt-20 lg:pb-32` for menu sections; `py-16 lg:py-24` for editorial note blocks.
- **List Row Padding:** `py-7 sm:py-9`.
- **Fixed Bar Heights:** `h-16` (header), `h-12` (marquee ledger), `h-9`/`h-10` (pill buttons).

### Sticky Hierarchy
1. `StorefrontHeader`: `fixed top-0 z-50 h-16` (transparent over hero, inverts to alabaster on scroll).
2. `CategoryNav`: `sticky top-16 z-40` (parks directly beneath the fixed header).
3. Sticky Preview Panel: `sticky top-32` (clears both navigation bars).

### Two-Column Asymmetric Menu
Desktop view splits into a fluid left column (`minmax(0, 1fr)`) containing the editorial list and a fixed right column (`360px`) housing the sticky `aspect-4/5` image preview panel. On mobile (<1024px), the preview panel hides and rows render inline `size-20 rounded-sm` thumbnails.

### Named Rules
**The Full-Bleed Edge Rule.** Sections span 100vw edge-to-edge. No centered `max-w-7xl` wrapper is permitted. Maximum line width is applied directly to text elements (`max-w-md`, `max-w-lg`, `max-w-[14ch]`).

## Elevation & Depth

KROMA is a flat, hairline-divided surface system. Depth is created through tonal layering and material shifts rather than drop shadows.

### Shadow Vocabulary
- **Image Frame Shadow** (`shadow-card`): `0 1px 3px rgba(26, 24, 22, 0.04), 0 6px 16px rgba(26, 24, 22, 0.03)`. Used exclusively on photographic containers and sticky preview frames.
- **Floating Pill Shadow** (`shadow-float`): `0 8px 30px rgba(26, 24, 22, 0.08)`. Used solely on floating status badges over photography and sticky cart pills.

### Named Rules
**The Hairline Rule.** Structural boundaries are created solely with `1px` hairlines in `#DCD6CA` (`border-y border-hairline`, `divide-y divide-hairline`). Bordered card enclosures are prohibited in list views.
**The Shadow Rarity Rule.** Shadows exist in only two specific roles (image frames and floating pills). Default containers and list rows never carry shadows.

## Shapes

The interface is architecturally near-square with disciplined, intentional corner curves.

### Corner Radii
- **`rounded-full` (9999px):** All interactive buttons, category navigation pills, status badges, and cart triggers.
- **`rounded-sm` (6px):** Mobile list row image thumbnails.
- **`rounded-lg` (16px):** Desktop sticky photo preview frame.
- **`rounded-md` (10px):** Form inputs, PIN pads, and dropdown menus.
- **`rounded-none` (0px):** All list rows, section blocks, full-bleed containers, and slide-over cart drawers.

### Named Rules
**The Three-Radii Law.** Storefront surfaces use only `rounded-full` for controls, `rounded-sm` for small thumbnails, and `rounded-lg` for large preview frames. No intermediate card radii are permitted on storefront layouts.

## Components

### Buttons
- **Shape:** `rounded-full` (`9999px`).
- **Primary CTA:** Background `accent-primary` (`#C85A2A`), text `surface-card` (`#FFFFFF`), padding `10px 20px`, mono text `11px` uppercase tracking `0.14em`.
- **Hover / Active:** Background shifts to `accent-hover` (`#AD4B20`); `whileTap` scale `0.98` on spring `{ stiffness: 400, damping: 25 }`.
- **Secondary / Muted:** Background `surface-muted` (`#EFECE4`), text `text-primary` (`#1A1816`).

### Category Navigation Pills
- **Active Pill:** Background `text-primary` (`#1A1816`), text `surface-canvas` (`#F8F6F0`), layout transition via Framer Motion `layoutId="activeCategory"`.
- **Inactive Pill:** Text `text-tertiary` (`#9B948C`), no background, hover text `text-primary`.

### MenuRow (Editorial List Row)
- **Structure:** Full-width interactive button between `divide-hairline` rules.
- **Title Line:** Serif item name (`clamp(28px, 3.2vw, 44px)`) and mono price (`€X.XX`) on baseline alignment.
- **Meta Line:** Mono uppercase `11px` at `tracking-[0.14em]` with `/` separators in `text-hairline`.
- **Hover State:** Title, description, and meta slide `x: 10` on spring `{ stiffness: 300, damping: 30, mass: 1 }`; terracotta `+ Add` fades in.
- **Sold Out:** Row disabled, name `text-tertiary`, image `grayscale`, meta displays "Gone for today" in `badge-alert` (`#B93826`).

### CartDrawer
- **Structure:** Full-height slide-over anchored to the right, `0px` radius, background `surface-card` (`#FFFFFF`).
- **Motion:** Enters from `x: "100%"` to `0%` on spring over a `bg-text-primary/25` backdrop.

### DayLedger (Marquee Ticker)
- **Structure:** Mono uppercase ticker bounded between two `border-hairline` rules.
- **Motion:** Seamless `70s` linear infinite marquee (`x: 0% → -50%`), paused on user reduced motion.

## Do's and Don'ts

### Do:
- **Do** use `Instrument Serif` weight 400 for all headings and wordmarks with fluid `clamp()` sizing.
- **Do** format every metadata string, label, badge, timestamp, and price in uppercase `JetBrains Mono` with wide tracking (`0.14em`–`0.18em`).
- **Do** separate menu items and sections with `1px` hairlines (`#DCD6CA`).
- **Do** use operational language: "Gone for today", "Only 3 left", "Baked this morning", "8–12 min queue".
- **Do** respect `prefers-reduced-motion` with complete graceful fallbacks on all animations.

### Don't:
- **Don't** use card grids or drop shadows for product listing views.
- **Don't** use cold greys, blue-tinted neutrals, or pure black (`#000000`).
- **Don't** use marketing buzzwords, exclamation marks, or e-commerce clichés ("Shop Now", "Exclusive Deal", "Sold Out").
- **Don't** round list rows, section banners, or modal drawer corners.
- **Don't** animate properties other than `transform` and `opacity`.
