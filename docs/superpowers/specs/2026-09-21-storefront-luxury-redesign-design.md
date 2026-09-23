# Design Specification: KROMA Storefront Luxury Redesign (Sensory Lookbook & Live Pass)

- **Date:** 2026-09-21
- **Status:** Approved
- **Target Surface:** `app/page.tsx` & `components/storefront/*`
- **Design Mode:** Persuade / Experience (Luxury Nordic-Japanese Atelier)

---

## 1. Overview & Vision

KROMA is elevated from a static coffee shop interface into an ultra-exclusive, tactile digital flagship for a Nordic-Japanese specialty roastery and micro-bakehouse.

The digital storefront balances the visual magnetism of a luxury fashion lookbook with the real-time operational precision of a Michelin-tier pass.

---

## 2. Visual & Sensory Design System

### 2.1 Color & Materiality
- **Surface Canvas:** `#F8F6F0` (Unbleached Japanese washi linen)
- **Deep Obsidian:** `#1A1816` (Raw charcoal / espresso depth)
- **Secondary Text:** `#5E5953` (Warm Umber, WCAG AA compliant 4.6:1+ contrast)
- **Terracotta Ochre:** `#C85A2A` (Fired clay / Nordic brick)
- **Subtle Hairlines:** `#DCD6CA`
- **Subtle Surface Muted:** `#EFECE4`
- **Tactile Paper Grain:** Ultra-fine SVG noise filter (`feTurbulence`) layered with `pointer-events-none` over the application canvas for organic physical texture.

### 2.2 Typography Hierarchy
- **Display & Headings:** `Instrument Serif` (`--font-instrument-serif`) with tight negative letterspacing (`tracking-[-0.025em]`).
- **Technical Telemetry & Specimen Codes:** `JetBrains Mono` (`--font-jetbrains-mono`) with wide letterspacing (`tracking-[0.14em]` to `tracking-[0.18em]`) in uppercase tabular numerals.
- **Descriptions & Body Copy:** High-legibility system sans-serif (`text-[14px]` to `text-[15px]`, line-height `1.6`, line length `< 65ch`).

---

## 3. Architecture & Component Structure

```
components/storefront/
├── Storefront.tsx             // Root client orchestration: categories, viewMode, cart, active drawers
├── StorefrontHeader.tsx       // Sticky blurred pill nav with local EET time, status pill, cart trigger
├── StorefrontHero.tsx         // 2.5D WebGL Depth Parallax with live operational telemetry & line reveal
├── DayLedger.tsx              // Seamless 70s marquee of oven schedules & live lot stock
├── MenuAtelier.tsx            // Menu container with category rail and view toggle [List | Lookbook]
│   ├── CategoryNav.tsx        // Sliding active pill category selector
│   ├── ViewToggle.tsx         // Pill toggle between Editorial List and Lookbook Gallery
│   ├── MenuList.tsx           // Hairline-divided list with desktop sticky specimen preview
│   ├── MenuRow.tsx            // Interactive row with tasting notes, origin details, quick-add
│   └── MenuLookbook.tsx       // Editorial masonry-inspired visual cards with sensory color tabs
├── ItemSpecimenDrawer.tsx     // Deep-dive inspection drawer: flavor notes, origin, water & brew specs
├── CraftDossier.tsx           // Interactive 3-tab craft explorer (12kg Drum, 4°C Ferment, Water Chemistry)
├── ModifierSheet.tsx          // Streamlined customization sheet with haptic spring feel
├── CartDrawer.tsx             // Artisan order ledger with batch reserves & checkout transition
└── SiteFooter.tsx             // Architectural inverted footer with full-width responsive SVG mark
```

---

## 4. Key Interactive Capabilities

### 4.1 Hero & Live Operational Telemetry
- Hero features 2.5D WebGL depth parallax with pointer interaction and reduced-motion fallback.
- Adds live operational status pill: Real-time Cluj-Napoca EET clock and live roast/bake status (e.g., `CLUJ-NAPOCA 08:42 EET • BATCH 04 IN PROOFER`).

### 4.2 Dual-Mode Menu Atelier
- **Editorial List Mode (Default):**
  - Elegant hairline-divided list with fluid typography.
  - Displays sensory tasting note tags (e.g., `Jasmine`, `Bergamot`, `Cardamom`).
  - Desktop sticky specimen preview plate with live image transitions.
  - Hover/focus slide animations (`x: 10px`) on standard spring physics.
- **Lookbook Gallery Mode:**
  - Editorial visual grid of items with prominent photography, tasting note pills, origin metadata, and direct add/customize actions.
  - Smooth animated transitions between modes using Framer Motion.

### 4.3 Item Specimen Drawer (Deep Dive)
- Clicking an item's details opens a slide-over / modal specimen dossier displaying:
  - High-resolution plate photography.
  - Detailed origin, varietal, process, and harvest elevation.
  - Sensory flavor radar notes.
  - Extraction and brew recipe specifications (ratio, temperature, contact time).
  - Direct customize and add-to-order flow.

### 4.4 Craft & Method Dossier
- Interactive tabbed narrative section replacing static text:
  - **Tab 01: The 12kg Drum** — Light-to-medium Scandinavian roast curves, development time ratios, 5-day resting cycle.
  - **Tab 02: 4°C Fermentation** — Wild sourdough starter, 18-hour cold bulk fermentation, morning 06:00 bake.
  - **Tab 03: Mineral Chemistry** — 94°C extraction, custom remineralized brew water (75 ppm GH, 25 ppm KH).

---

## 5. Sensory Tasting Data & Metadata Model

Every menu item is enhanced with luxury sensory attributes:
- `tastingNotes: string[]` (e.g., `["Jasmine", "White Peach", "Honeyed Bergamot"]`)
- `elevation?: string` (e.g., `1,900m`)
- `harvest?: string` (e.g., `2025/2026 Crop`)
- `brewSpec?: { temp: string, ratio: string, notes: string }`

---

## 6. Motion & Accessibility

- **Standard Physics:** `spring` (`stiffness: 300, damping: 30`) and `pressSpring` (`stiffness: 400, damping: 25`).
- **Reduced Motion:** Full support for `prefers-reduced-motion` across all components (instant opacity transitions without transforms).
- **Keyboard Navigation:** Full focus rings (`focus-visible:outline-2 focus-visible:outline-border-focus`), ARIA expanded and modal attributes, escape key listeners on all drawers.
- **Contrast & Hierarchy:** All text meets WCAG AA 4.5:1+ contrast requirements against respective backgrounds.

---

## 7. Verification & Testing Strategy

1. **Visual & Interaction Verification:**
   - Test both Editorial List and Lookbook Gallery view modes.
   - Verify category filtering, modifier customization, and cart interactions.
   - Verify Craft Dossier tab switching and Specimen Drawer deep-dive view.
   - Verify responsive behavior on desktop (1440px), tablet (768px), and mobile (375px).
2. **Reduced Motion Check:** Verify behavior with reduced motion enabled.
3. **Build & Type Check:** Run `npm run build` to ensure zero TypeScript errors and Next.js static generation success.
