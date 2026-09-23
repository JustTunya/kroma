# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Guests & Locals:** Specialty coffee and pastry enthusiasts in Cluj-Napoca ordering ahead for bar collection, tracking morning bake drops, reordering "The Usual", and collecting digital punch card rewards.
- **Baristas & Bakers:** Front-of-house baristas and kitchen staff managing incoming ticket queues, tracking ticket age, adjusting live batch stock, recording cash payments, and performing end-of-day drawer reconciliation.

## Product Purpose

KROMA connects a third-wave micro-roastery and slow-fermentation bakehouse directly to its community. It provides frictionless mobile pre-ordering, transparent live preparation tracking, customer loyalty, and a dedicated staff Kitchen Display System (KDS) and ops dashboard.

## Positioning

An operational-first café commerce system designed around the rhythms of specialty coffee extraction and morning bakehouse batches. Replaces noisy e-commerce patterns with transparent real-time batch limits, live queue turnaround times, and clean counter pickup.

## Operating Context

- **Physical Space:** Str. Universității 12, Cluj-Napoca, Romania. Mon–Fri 07:30–18:00 | Sat–Sun 08:30–17:00.
- **Physical Rituals:** Single-batch morning bakes (06:00 fresh pull, finite quantities), Scandinavian light-medium roast profiles, 8–12 minute live coffee queues during morning surges.
- **Pickup Flow:** Contactless mobile order → real-time tokenized status page → counter collection at the bar via receipt/barcode.

## Capabilities and Constraints

- **Guest Experience:** Dynamic batch stock awareness ("Gone for today", "Only N left"), milk & bean modifier customizers, cart synchronization, Stripe payments, tokenized live order status & printable receipts, customer accounts with 10-stamp punch card loyalty and "The Usual" 1-click reordering.
- **Staff Operations:** PIN-protected barista dashboard, real-time KDS lane board with ticket aging spines, instant item availability toggles, manual/cash entry, service discount sheets, shift management, and cash-count ledger closeouts.
- **Technical Stack:** Next.js 16 App Router, React 19, Supabase (PostgreSQL with RLS and Realtime), Stripe, Web Push API, Tailwind CSS v4, Framer Motion, PWA installability.
- **Voice & Copy Rules:** Terse, operational declaratives ("Roasted Tuesday. Baked this morning. Collected at the bar."). Concrete timestamps and batch metrics (`18 h bulk`, `4°C overnight`, `Baked 06:00`). No buzzwords, marketing fluff, or exclamation points.

## Brand Commitments

- **Identity:** KROMA Coffee & Bakehouse — Specialty Roastery & Micro-Bakehouse.
- **Design Language:** Nordic-Japanese minimalism, warm Alabaster canvas (`#F8F6F0`), Deep Roasted Espresso dark surfaces (`#1A1816`), Burnt Terracotta accents (`#C85A2A`), 1px hairline rule structure (`#DCD6CA`), and Instrument Serif paired with JetBrains Mono and system UI sans.

## Evidence on Hand

- Fully functional codebase implementing storefront (`app/page.tsx`), checkout (`app/checkout`), live order receipt (`app/order/[token]`), customer loyalty (`app/account`), and staff KDS (`app/dashboard`).
- Comprehensive brand and styling system in `CLAUDE.md`.
- Supabase schema migrations for carts, orders, profiles, and punch cards in `supabase/migrations/`.
- Production assets including hero WebGL parallax plate and depth map in `public/`.

## Product Principles

1. **Operational Truth Over Marketing:** State exact batch reality, bake timings, and prep queues without marketing exaggeration or artificial scarcity.
2. **Frictionless Counter Cadence:** Keep guest ordering and barista fulfillment tightly synchronized so guests pick up at peak temperature and freshness.
3. **One Shared Heartbeat:** Treat the customer storefront and the kitchen KDS as two synced vantage points of the exact same physical counter.
4. **Craft Through Restraint:** Eliminate decorative noise; let typography, hairline divisions, and product materiality carry the experience.

## Accessibility & Inclusion

- Strict adherence to WCAG contrast standards across light canvas and dark KDS inverted surfaces.
- Explicit ARIA announcements for live queue states (`role="status"`) and stock alerts.
- Full keyboard parity for all menu modifiers, drawer trays, and KDS board controls.
- Mandatory `prefers-reduced-motion` fallbacks across all animations and WebGL shaders.
