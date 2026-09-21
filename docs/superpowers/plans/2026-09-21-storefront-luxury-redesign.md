# Storefront Luxury Redesign (Sensory Lookbook & Live Pass) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Elevate KROMA's digital storefront into an ultra-exclusive, tactile Nordic-Japanese specialty atelier featuring dual-mode menu browsing (Editorial List & Lookbook Gallery), real-time operational telemetry, sensory tasting notes, an interactive specimen drawer, and an interactive Craft & Method dossier.

**Architecture:** Extend existing Next.js 16 App Router client/server split. Server fetches and enriches menu items with sensory data (`lib/menu-enrichment.ts`), then passes them to `Storefront.tsx` which manages category filtering, view mode (`list` vs `lookbook`), specimen deep-dive drawer, modifier customization, and cart interactions with Framer Motion spring physics.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion 13, Lucide React, TypeScript 5.

**Spec:** `docs/superpowers/specs/2026-09-21-storefront-luxury-redesign-design.md`

## Global Constraints
- Brand & Copy rules: Period-separated declaratives, operational states ("Gone for today", "Only N left"), no exclamation marks.
- Accessibility: Minimum 44x44px touch targets, visible focus outlines (`focus-visible:outline-2 focus-visible:outline-border-focus`), ARIA expanded/modal attributes, full keyboard navigation, `prefers-reduced-motion` compliance.
- Responsive design: Mobile-first, seamless scaling from 375px mobile to 1440px+ ultra-wide desktop.
- Verification: Zero TypeScript compilation errors (`npx tsc --noEmit` and `pnpm build`).

---

### Task 1: Type Definitions & Sensory Data Enrichment

**Files:**
- Modify: `types/menu.ts`
- Create: `lib/menu-enrichment.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `types/menu.ts` (`MenuItem`), `menu.json`
- Produces: Enhanced `MenuItem` with `tasting_notes`, `elevation`, `harvest`, and `brew_spec`

- [x] **Step 1: Update `types/menu.ts` with sensory fields**

Add `tasting_notes?: string[]`, `elevation?: string | null`, `harvest?: string | null`, `brew_spec?: { temp: string; ratio: string; notes: string } | null` to `MenuItem`.

```typescript
export type BrewSpec = {
  temp: string;
  ratio: string;
  notes: string;
};

export type MenuItem = Pick<
  MenuItemRow,
  "id" | "name" | "description" | "base_price" | "daily_stock" | "dietary_tags"
> & {
  category: string;
  vat_rate: number;
  image_url: string;
  origin: string | null;
  process: string | null;
  roast: string | null;
  modifiers: ModifierGroup[];
  tasting_notes?: string[];
  elevation?: string | null;
  harvest?: string | null;
  brew_spec?: BrewSpec | null;
};
```

- [x] **Step 2: Create `lib/menu-enrichment.ts`**

Map every menu item name to artisanal tasting descriptors, elevation, harvest year, and extraction specifications.

- [x] **Step 3: Update `app/page.tsx` to apply sensory enrichment**

Apply `enrichMenuItem(item)` in `fetchMenu` so all items consistently carry tasting notes and terroir details.

- [x] **Step 4: Run type check to verify**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [x] **Step 5: Commit**

```bash
git add types/menu.ts lib/menu-enrichment.ts app/page.tsx
git commit -m "feat(storefront): enrich menu items with sensory tasting and terroir data"
```

---

### Task 2: Subtle Material Canvas & Paper Grain Texture

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: Ambient SVG grain noise filter and background texture across the app canvas.

- [x] **Step 1: Add SVG Grain Filter in `app/layout.tsx`**

Inject a lightweight, hardware-accelerated inline SVG filter (`#grain-filter`) positioned with `fixed inset-0 pointer-events-none opacity-[0.035] mix-blend-overlay` so all surfaces gain an authentic matte washi texture without performance overhead.

- [x] **Step 2: Update `app/globals.css` tokens and styling**

Ensure `--color-surface-canvas`, `--color-text-primary`, `--color-text-secondary`, and `--color-accent-primary` tokens are strictly maintained with optimal contrast.

- [x] **Step 3: Run type check to verify**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [x] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "style(storefront): add tactile paper grain overlay and refine material tokens"
```

---

### Task 3: Storefront Header & Hero Telemetry

**Files:**
- Modify: `components/storefront/StorefrontHeader.tsx`
- Modify: `components/storefront/StorefrontHero.tsx`

**Interfaces:**
- Consumes: `useScroll`, `useActiveOrder`, `HeroParallax`
- Produces: Header with real-time Cluj EET clock, live order status, and Hero with operational roast telemetry.

- [x] **Step 1: Update `components/storefront/StorefrontHeader.tsx`**

Add local Cluj time display (`EET / UTC+2`), active status pill, and responsive controls with fluid color transitions on scroll.

- [x] **Step 2: Update `components/storefront/StorefrontHero.tsx`**

Add live batch telemetry bar (`CLUJ-NAPOCA 08:42 EET • BATCH 04 PROOFING • 12KG DRUM RESTING`), stagger reveal animations, and fluid typography.

- [x] **Step 3: Run type check to verify**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [x] **Step 4: Commit**

```bash
git add components/storefront/StorefrontHeader.tsx components/storefront/StorefrontHero.tsx
git commit -m "feat(storefront): enhance header and hero with real-time operational telemetry"
```

---

### Task 4: View Mode Toggle & Category Navigation

**Files:**
- Create: `components/storefront/ViewToggle.tsx`
- Modify: `components/storefront/CategoryNav.tsx`

**Interfaces:**
- Consumes: `activeCategory`, `onSelectCategory`, `viewMode`, `onViewModeChange`
- Produces: Fluid category rail with sliding pill indicator and view switch between Editorial List and Lookbook Gallery.

- [x] **Step 1: Create `components/storefront/ViewToggle.tsx`**

Implement accessible toggle with icons (`List` & `LayoutGrid`) and Framer Motion `layoutId="activeViewToggle"` sliding indicator.

- [x] **Step 2: Enhance `components/storefront/CategoryNav.tsx`**

Integrate `ViewToggle` into the sticky category navigation bar with responsive layout (compact on mobile, aligned on desktop) and keyboard navigation support.

- [x] **Step 3: Run type check to verify**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [x] **Step 4: Commit**

```bash
git add components/storefront/ViewToggle.tsx components/storefront/CategoryNav.tsx
git commit -m "feat(storefront): add dual view toggle and refine category navigation"
```

---

### Task 5: Interactive Menu Row & Editorial List View

**Files:**
- Modify: `components/storefront/MenuRow.tsx`
- Modify: `components/storefront/MenuList.tsx`

**Interfaces:**
- Consumes: `MenuItem`, `onAdd`, `onPreview`, `onOpenSpecimen`
- Produces: Enhanced editorial row with sensory flavor chips, specimen details trigger, quick-add action, and desktop preview plate.

- [x] **Step 1: Update `components/storefront/MenuRow.tsx`**

Add tasting notes chips (e.g. `Jasmine / White Peach`), specimen inspector button (`View Specimen`), and fluid hover slide effect with accessibility attributes.

- [x] **Step 2: Update `components/storefront/MenuList.tsx`**

Pass `onOpenSpecimen` handler and render sticky preview plate with active item's sensory notes, origin, and elevation on desktop.

- [x] **Step 3: Run type check to verify**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [x] **Step 4: Commit**

```bash
git add components/storefront/MenuRow.tsx components/storefront/MenuList.tsx
git commit -m "feat(storefront): enhance menu rows with sensory tags and specimen triggers"
```

---

### Task 6: Visual Lookbook Gallery View

**Files:**
- Create: `components/storefront/MenuLookbook.tsx`

**Interfaces:**
- Consumes: `items: MenuItem[]`, `onAdd: (item: MenuItem) => void`, `onOpenSpecimen: (item: MenuItem) => void`
- Produces: Luxury lookbook grid with editorial photo plates, tasting note overlays, elevation badges, and quick-add actions.

- [x] **Step 1: Create `components/storefront/MenuLookbook.tsx`**

Build responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) with:
- High-res image container with hover zoom (`scale-105` transition)
- Sensory flavor tags floating over image bottom
- Origin, process, elevation, and stock alert indicators
- Action bar with "Inspect" (opens specimen drawer) and "+ Add to Order"
- Full reduced-motion and keyboard navigation support

- [x] **Step 2: Run type check to verify**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
git add components/storefront/MenuLookbook.tsx
git commit -m "feat(storefront): implement luxury lookbook gallery view"
```

---

### Task 7: Item Specimen Inspection Drawer

**Files:**
- Create: `components/storefront/ItemSpecimenDrawer.tsx`

**Interfaces:**
- Consumes: `item: MenuItem | null`, `onClose: () => void`, `onAdd: (item: MenuItem) => void`, `onCustomize: (item: MenuItem) => void`
- Produces: Deep-dive modal drawer displaying detailed terroir story, tasting radar chips, water & brew specs, and direct order actions.

- [x] **Step 1: Create `components/storefront/ItemSpecimenDrawer.tsx`**

Build slide-over drawer with:
- High-resolution hero image of the plate/cup
- Item title, category, price, and stock status
- Terroir & Provenance card: Origin country, washing station/mill, elevation, harvest year
- Sensory Profile: Curated tasting notes breakdown
- Extraction & Preparation specs: Water temp (94°C), brew ratio (1:16.5 / 1:2), extraction profile
- Direct Add to Order / Customize button triggering `ModifierSheet` if customizable
- Escape key listener, backdrop click, focus trap, and ARIA dialog semantics

- [x] **Step 2: Run type check to verify**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
git add components/storefront/ItemSpecimenDrawer.tsx
git commit -m "feat(storefront): create item specimen inspection drawer"
```

---

### Task 8: Interactive Craft & Method Dossier

**Files:**
- Create: `components/storefront/CraftDossier.tsx`
- Modify: `components/storefront/CraftNotes.tsx` (or replace with `CraftDossier`)

**Interfaces:**
- Produces: Interactive 3-tab craft explorer detailing The 12kg Drum, 4°C Fermentation, and Mineral Chemistry with technical metrics and smooth animated transitions.

- [x] **Step 1: Create `components/storefront/CraftDossier.tsx`**

Build 3-tab interactive section:
- Tab 1: **Roasting (The 12kg Drum)** — Light-medium Scandinavian profile, 5-day resting curve, Agtron 68 color target.
- Tab 2: **Fermenting (4°C Overnight)** — Wild levain sourdough, 18h bulk retard, 06:00 dawn bake.
- Tab 3: **Water Chemistry (Custom Mineral Recipe)** — 94°C extraction, 75 ppm GH, 25 ppm KH, zero chloramines.
- Tab navigation with `layoutId="activeCraftTab"` sliding underline and smooth content fade-in.

- [x] **Step 2: Run type check to verify**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
git add components/storefront/CraftDossier.tsx
git commit -m "feat(storefront): build interactive craft and method dossier"
```

---

### Task 9: Storefront Root Integration & Verification

**Files:**
- Modify: `components/storefront/Storefront.tsx`

**Interfaces:**
- Consumes: All storefront components (`StorefrontHeader`, `StorefrontHero`, `DayLedger`, `CategoryNav`, `ViewToggle`, `MenuList`, `MenuLookbook`, `ItemSpecimenDrawer`, `CraftDossier`, `ModifierSheet`, `CartDrawer`, `SiteFooter`)
- Produces: Unified luxury digital atelier storefront experience.

- [x] **Step 1: Update `components/storefront/Storefront.tsx`**

Integrate view mode state (`list` vs `lookbook`), specimen drawer state (`selectedSpecimen`), and render `MenuList` or `MenuLookbook` seamlessly with Framer Motion `AnimatePresence`.

- [x] **Step 2: Run full build and type checking**

Run: `pnpm build`
Expected: Static generation succeeds with 0 errors.

- [x] **Step 3: Commit**

```bash
git add components/storefront/Storefront.tsx
git commit -m "feat(storefront): integrate luxury storefront atelier experience"
```
