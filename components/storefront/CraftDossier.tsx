"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Droplet, Flame, Sparkles } from "lucide-react";

import { pressSpring, spring } from "@/lib/motion";
import { glide } from "@/lib/reveal";
import { cn } from "@/lib/utils";

type CraftTab = "roasting" | "fermentation" | "water";

const TABS: { id: CraftTab; label: string; icon: typeof Flame; subtitle: string }[] = [
  {
    id: "roasting",
    label: "01. The 12kg Drum",
    icon: Flame,
    subtitle: "Light-to-medium Scandinavian roast curves",
  },
  {
    id: "fermentation",
    label: "02. 4°C Ferment",
    icon: Sparkles,
    subtitle: "Wild levain & 18h overnight cold bulk",
  },
  {
    id: "water",
    label: "03. Water Chemistry",
    icon: Droplet,
    subtitle: "Custom mineral remineralization recipe",
  },
];

const CONTENT: Record<
  CraftTab,
  {
    title: string;
    narrative: string;
    metrics: { label: string; value: string; detail: string }[];
    footerNotes: string;
  }
> = {
  roasting: {
    title: "Tuesdays on the drum: Light profile, maximum sweetness.",
    narrative:
      "We roast the week's coffee exclusively on our cast-iron 12kg drum roaster. Every batch follows a Scandinavian light-to-medium curve that preserves floral enzymatics and origin sweetness. Beans rest for a strict 5-day cycle before serving.",
    metrics: [
      { label: "Drum Capacity", value: "12 kg", detail: "Small batch precision" },
      { label: "Resting Window", value: "5 Days", detail: "Degassing peak flavor" },
      { label: "Target Agtron", value: "68 / 82", detail: "Ground / Whole bean index" },
      { label: "Crop Rotation", value: "2 Origins", detail: "Fresh seasonal harvests" },
    ],
    footerNotes: "Roasted in Cluj-Napoca • Single-origin harvest rotation",
  },
  fermentation: {
    title: "Mixed at dusk, baked at dawn: 18 hours at 4°C.",
    narrative:
      "Our micro-bakehouse relies on slow cold fermentation with 100% wild levain starter. Dough is mixed in the afternoon and rested at 4°C overnight to develop complex acids and honeycomb crumb structure. Once morning batches sell out, shelves stay clear until the next day.",
    metrics: [
      { label: "Bulk Ferment", value: "18 Hours", detail: "Cold retarded at 4°C" },
      { label: "Lamination", value: "72 Hours", detail: "French Normandy butter" },
      { label: "Oven Pull", value: "06:00", detail: "Fresh dawn extraction" },
      { label: "Starter Age", value: "6 Years", detail: "Active wild rye levain" },
    ],
    footerNotes: "No commercial additives • Baked daily at dawn",
  },
  water: {
    title: "Engineered mineral chemistry for pure cup extraction.",
    narrative:
      "Specialty coffee is 98.5% water. We filter city water through reverse osmosis and remineralize it with calibrated magnesium and bicarbonate salts to ensure clean solvent extraction without masking delicate acidity.",
    metrics: [
      { label: "Extraction Temp", value: "94.0°C", detail: "PID thermal stability" },
      { label: "General Hardness", value: "75 ppm", detail: "Optimized Mg2+ binding" },
      { label: "Alkalinity", value: "25 ppm", detail: "Target buffer balance" },
      { label: "Total Dissolved", value: "110 ppm", detail: "SCA standard compliance" },
    ],
    footerNotes: "Zero chloramines • Remineralized on-demand at the bar",
  },
};

export function CraftDossier() {
  const [activeTab, setActiveTab] = useState<CraftTab>("roasting");
  const reduced = useReducedMotion();
  const activeContent = CONTENT[activeTab];

  return (
    <section
      aria-label="Atelier Craft & Method Dossier"
      className="border-t border-hairline bg-surface-canvas px-5 py-16 sm:px-10 lg:px-14 lg:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
            Atelier Methodology &amp; Chemistry
          </p>
          <h2 className="font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
            Craft Dossier
          </h2>
        </div>

        {/* Tab Navigation */}
        <div
          role="tablist"
          aria-label="Craft methodology tabs"
          className="mt-8 flex flex-wrap gap-2 border-b border-hairline pb-4 sm:gap-3"
        >
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const Icon = tab.icon;

            return (
              <motion.button
                key={tab.id}
                role="tab"
                type="button"
                id={`craft-tab-${tab.id}`}
                aria-controls={`craft-panel-${tab.id}`}
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                whileTap={{ scale: 0.98 }}
                transition={pressSpring}
                className={cn(
                  "relative flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[11px] font-medium tracking-[0.12em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                  isActive
                    ? "text-surface-canvas"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-muted",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeCraftTab"
                    transition={spring}
                    className="absolute inset-0 rounded-full bg-text-primary"
                    aria-hidden
                  />
                )}
                <Icon aria-hidden size={13} className="relative" />
                <span className="relative">{tab.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Tab Panel */}
        <div
          id={`craft-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`craft-tab-${activeTab}`}
          className="mt-8"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={glide}
              className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16"
            >
              <div>
                <h3 className="font-serif text-[clamp(24px,2.8vw,36px)] leading-[1.1] tracking-[-0.02em] text-text-primary">
                  {activeContent.title}
                </h3>
                <p className="mt-4 text-[15px] leading-[1.65] text-text-secondary">
                  {activeContent.narrative}
                </p>
                <p className="mt-6 font-mono text-[11px] tracking-[0.14em] text-accent-primary uppercase">
                  {activeContent.footerNotes}
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                {activeContent.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="flex flex-col justify-between rounded-sm border border-border-subtle bg-surface-card p-4 shadow-card"
                  >
                    <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-text-tertiary uppercase">
                      {metric.label}
                    </span>
                    <div className="my-2 font-serif text-[28px] font-normal leading-none text-text-primary">
                      {metric.value}
                    </div>
                    <span className="text-[12px] text-text-secondary leading-[1.3]">
                      {metric.detail}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
