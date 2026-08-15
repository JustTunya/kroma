## 1. Brand Identity & Positioning

* **Brand Name:** KROMA Coffee & Bakehouse
* **Brand Tagline:** Specialty Roastery & Micro-Bakehouse
* **Brand Philosophy:** Minimalist, third-wave specialty coffee and slow-fermentation bakery inspired by modern Nordic-Japanese café culture. Clean lines, warm materiality, functional precision, and zero visual clutter.
* **Tone of Voice:** Warm, confident, minimal, craft-focused, direct. No corporate buzzwords or excessive hype.
* **Simulated Location / Origin:** 
  * Address: Str. Universității 12, Cluj-Napoca, Romania
  * Hours: Mon–Fri 07:30–18:00 | Sat–Sun 08:30–17:00
  * Roasting Ethos: Light-to-medium Scandinavian profile, single-origin focus, seasonal crop rotation.

---

## 2. Color Palette & Semantic Tokens

All color decisions must adhere strictly to this tokenized warm-neutral palette. Avoid cold blues, neon accents, or harsh pure blacks (`#000000`).

### Palette Definitions

| Token | Hex Value | Role & Usage |
| :--- | :--- | :--- |
| `surface-canvas` | `#F8F6F0` | Warm Alabaster – primary app/page background |
| `surface-card` | `#FFFFFF` | Pure White – cards, modals, sheets, elevated elements |
| `surface-muted` | `#EFECE4` | Stone tint – secondary surfaces, pill backgrounds, skeleton states |
| `border-subtle` | `#E4DFD5` | Primary divider, card borders, subtle separators |
| `border-focus` | `#1A1816` | Focused inputs, active selections, high-contrast borders |
| `text-primary` | `#1A1816` | Deep Roasted Espresso – headings, body text, strong visual anchors |
| `text-secondary` | `#635E59` | Muted Ash – descriptions, subtitles, inactive states, metadata |
| `text-tertiary` | `#9B948C` | Warm Grey – timestamps, placeholder text, disabled states |
| `accent-primary` | `#C85A2A` | Burnt Terracotta – primary CTAs, active pills, checkout buttons |
| `accent-hover` | `#AD4B20` | Deep Terracotta – hover/pressed states on primary CTAs |
| `accent-subtle` | `#F8EFEB` | Soft Peach – warning/badge backgrounds, light accent surfaces |
| `badge-live` | `#2D6A4F` | Forest Green – live queue status, positive kitchen status |
| `badge-alert` | `#B93826` | Deep Rust/Crimson – sold out badges, batch low warnings |

### Dark Theme / Barista Tablet KDS Mode (Optional Surface Variant)
For the Barista Kitchen Display System (`/barista` or `/kitchen`):
* `kds-canvas`: `#141211`
* `kds-surface`: `#1E1B19`
* `kds-border`: `#2E2A27`
* `kds-text-primary`: `#F8F6F0`
* `kds-text-secondary`: `#A39C94`

---

## 3. Typography System

The typography marries editorial craft with operational clarity.

### Font Families
* **Display / Editorial Headings:** `Instrument Serif` (Google Fonts) or `Playfair Display`
  * *Usage:* Hero titles, brand logo lockup, section lead-ins. Always set with tight line height.
* **Primary Sans / UI Body:** `Plus Jakarta Sans` or `Inter`
  * *Usage:* Product names, navigation labels, descriptions, modifier options, button labels.
* **Tabular / Monospace:** `JetBrains Mono` or `Geist Mono`
  * *Usage:* Prices (`€4.50`), order tokens (`#042`), estimated wait times (`8-12m`), batch stock numbers (`3 left`), barcode/QR labels.

### Typography Hierarchy

| Style Role | Font Family | Size / Leading | Weight | Tracking |
| :--- | :--- | :--- | :--- | :--- |
| **Display 1** | Serif | `36px–44px` / 1.1 | 400 (Regular / Italic accents) | `-0.02em` |
| **Heading 2** | Sans / Serif | `24px–28px` / 1.2 | 600 (Sans) or 400 (Serif) | `-0.01em` |
| **Heading 3** | Sans | `18px–20px` / 1.3 | 600 (SemiBold) | `-0.01em` |
| **Body Large** | Sans | `16px` / 1.5 | 400 (Regular) | `0` |
| **Body Small** | Sans | `14px` / 1.4 | 400 / 500 | `0` |
| **Data / Price**| Mono | `13px–15px` / 1.0 | 500 / 600 | `0.02em` |
| **Micro Badge** | Sans / Mono | `11px–12px` / 1.0 | 600 (SemiBold) | `0.04em` (Uppercase) |

---

## 4. Radii, Spacing & Elevation

KROMA uses generous, organic curves paired with razor-sharp borders to create an approachable tactile feeling.

### Border Radius Rules
* `radius-sm`: `6px` – Small badges, modifier checkboxes, price pills.
* `radius-md`: `10px` – Form inputs, dropdown menus, quick-add buttons.
* `radius-lg`: `16px` – Product cards, drawer containers, customer tracking banners.
* `radius-xl`: `24px` – Modals, bottom checkout sheets, hero cards.
* `radius-full`: `9999px` – Filter pill selectors, circular icon action buttons, live status dots.

### Border & Stroke Styling
* Standard cards and interactive containers must use a crisp `1px` solid border (`border-subtle`: `#E4DFD5`).
* Selected / active modifier pills toggle to a `1.5px` or `2px` solid stroke (`text-primary` or `accent-primary`).
* Avoid thick drop shadows; prefer surface color contrast and single-pixel borders for visual hierarchy.

### Shadow Tokens
* `shadow-card`: `0 1px 3px rgba(26, 24, 22, 0.04), 0 6px 16px rgba(26, 24, 22, 0.03)`
* `shadow-float`: `0 8px 30px rgba(26, 24, 22, 0.08)` (Used exclusively for sticky cart pill and bottom drawers)

---

## 5. Imagery & Visual Assets Guidelines

* **Photography Style:** High-contrast natural light, warm wooden textures, textured matte ceramics, linen backgrounds, warm beige stone countertops, soft morning daylight.
* **Composition:** Overhead flat-lay or 45-degree close-up showcasing product craft (e.g., latte microfoam, glossy pastry lamination, clear ice cubes in cold brew).
* **Aspect Ratios:**
  * Product Grid Cards: `4:3` or `1:1` square with subtle image scale (`scale-102`) on card hover.
  * Modal / Sheet Featured Preview: `16:9` or `3:2`.
* **Image Containers:** Always encapsulated with `radius-lg` and an inner border or soft background fallback (`#EFECE4`) to avoid layout jumps while loading.

---

## 6. Micro-Interactions & UI Behavior Rules

* **Cart & Customization Drawers:** Bottom-sheet drawer on mobile screens; slide-over panel or centered modal on desktop viewports.
* **Price Feedback:** Whenever a modifier (e.g., Oat Milk +€0.60) is selected, price animations should be instant with a slight scale bump or digit transition in monospace font.
* **Batch Stock Alerts:**
  * If stock $\le$ 5: Display a subtle Terracotta alert badge (`Only X left today`).
  * If stock $= 0$: Greyscale the card thumbnail, disable selection, and overlay an elegant `Sold Out` stamp badge.
* **Button States:**
  * Default CTA: Background `accent-primary` (`#C85A2A`), text `#FFFFFF`.
  * Active/Click: Immediate slight compression (`scale-98`).
  * Disabled: Background `surface-muted`, text `text-tertiary`, border `border-subtle`.