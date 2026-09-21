"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Compass, SlidersHorizontal, Sparkles, Thermometer, X } from "lucide-react";

import { pressSpring, spring } from "@/lib/motion";
import { useEscapeClose } from "@/lib/use-escape-close";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/menu";

type ItemSpecimenDrawerProps = {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem) => void;
  onCustomize: (item: MenuItem) => void;
};

export function ItemSpecimenDrawer({
  item,
  onClose,
  onAdd,
  onCustomize,
}: ItemSpecimenDrawerProps) {
  const reduced = useReducedMotion();
  useEscapeClose(Boolean(item), onClose);

  if (!item) return null;

  const soldOut = item.daily_stock === 0;
  const hasModifiers = item.modifiers && item.modifiers.length > 0;

  function handlePrimaryAction() {
    if (!item || soldOut) return;
    if (hasModifiers) {
      onCustomize(item);
      onClose();
    } else {
      onAdd(item);
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {item && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
            aria-hidden
            className="absolute inset-0 bg-text-primary/40 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Specimen dossier for ${item.name}`}
            initial={reduced ? false : { y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: "100%", opacity: 0 }}
            transition={reduced ? { duration: 0 } : spring}
            className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden bg-surface-card shadow-float sm:m-6 sm:rounded-sm border border-border-subtle"
          >
            {/* Header / Hero Plate */}
            <div className="relative aspect-16/9 w-full shrink-0 overflow-hidden bg-surface-muted border-b border-hairline">
              <Image
                src={item.image_url}
                alt=""
                fill
                sizes="(min-width: 640px) 576px, 100vw"
                className={cn("object-cover", soldOut && "grayscale")}
              />
              <div className="absolute inset-0 bg-linear-to-t from-text-primary/85 via-text-primary/30 to-transparent" />

              <motion.button
                type="button"
                onClick={onClose}
                whileTap={{ scale: 0.98 }}
                transition={pressSpring}
                aria-label="Close specimen dossier"
                className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-surface-canvas/80 text-text-primary backdrop-blur-md transition-colors hover:bg-surface-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                <X aria-hidden size={16} strokeWidth={2} />
              </motion.button>

              <div className="absolute inset-x-0 bottom-0 p-6 text-surface-canvas">
                <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-surface-canvas/70 uppercase">
                  {item.category} • Specimen Lot
                </span>
                <div className="mt-1.5 flex items-baseline justify-between gap-4">
                  <h2 className="font-serif text-[clamp(28px,4vw,38px)] leading-[1.05] tracking-[-0.02em]">
                    {item.name}
                  </h2>
                  <span className="font-mono text-[18px] font-medium tabular-nums tracking-[0.02em] text-surface-canvas">
                    €{item.base_price.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
              {/* Description */}
              {item.description && (
                <p className="text-[15px] leading-[1.6] text-text-secondary">
                  {item.description}
                </p>
              )}

              {/* Sensory Tasting Notes */}
              {item.tasting_notes && item.tasting_notes.length > 0 && (
                <div className="rounded-sm border border-border-subtle bg-surface-canvas p-4">
                  <p className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
                    <Sparkles size={12} aria-hidden />
                    Sensory Profile
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.tasting_notes.map((note) => (
                      <span
                        key={note}
                        className="inline-flex items-center rounded-full border border-hairline bg-surface-card px-3 py-1 font-mono text-[11px] font-medium tracking-[0.08em] text-text-primary"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Terroir & Origin Metrics */}
              <div className="rounded-sm border border-border-subtle bg-surface-canvas p-4">
                <p className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
                  <Compass size={12} aria-hidden />
                  Terroir &amp; Provenance
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-[11px]">
                  {item.origin && (
                    <div>
                      <dt className="text-text-tertiary text-[10px] uppercase tracking-[0.12em]">Origin</dt>
                      <dd className="mt-1 font-medium text-text-primary">{item.origin}</dd>
                    </div>
                  )}
                  {item.elevation && (
                    <div>
                      <dt className="text-text-tertiary text-[10px] uppercase tracking-[0.12em]">Elevation</dt>
                      <dd className="mt-1 font-medium text-text-primary">{item.elevation}</dd>
                    </div>
                  )}
                  {item.process && (
                    <div>
                      <dt className="text-text-tertiary text-[10px] uppercase tracking-[0.12em]">Process</dt>
                      <dd className="mt-1 font-medium text-text-primary">{item.process}</dd>
                    </div>
                  )}
                  {item.harvest && (
                    <div>
                      <dt className="text-text-tertiary text-[10px] uppercase tracking-[0.12em]">Harvest / Lot</dt>
                      <dd className="mt-1 font-medium text-text-primary">{item.harvest}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Extraction / Preparation Specs */}
              {item.brew_spec && (
                <div className="rounded-sm border border-border-subtle bg-surface-canvas p-4">
                  <p className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
                    <Thermometer size={12} aria-hidden />
                    Extraction &amp; Craft Parameters
                  </p>
                  <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 font-mono text-[11px]">
                    <div>
                      <dt className="text-text-tertiary text-[10px] uppercase tracking-[0.12em]">Temperature</dt>
                      <dd className="mt-1 font-medium text-text-primary">{item.brew_spec.temp}</dd>
                    </div>
                    <div>
                      <dt className="text-text-tertiary text-[10px] uppercase tracking-[0.12em]">Ratio / Dose</dt>
                      <dd className="mt-1 font-medium text-text-primary">{item.brew_spec.ratio}</dd>
                    </div>
                    <div className="sm:col-span-3">
                      <dt className="text-text-tertiary text-[10px] uppercase tracking-[0.12em]">Preparation Notes</dt>
                      <dd className="mt-1 text-text-secondary leading-[1.5]">{item.brew_spec.notes}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between gap-3 border-t border-hairline p-5 bg-surface-card">
              {soldOut ? (
                <span className="font-mono text-[12px] font-medium tracking-[0.12em] text-badge-alert uppercase">
                  Gone for today
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  {hasModifiers && (
                    <motion.button
                      type="button"
                      onClick={() => {
                        onCustomize(item);
                        onClose();
                      }}
                      whileTap={{ scale: 0.98 }}
                      transition={pressSpring}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-hairline px-4 font-mono text-[11px] font-medium tracking-[0.14em] text-text-primary uppercase transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                    >
                      <SlidersHorizontal size={13} aria-hidden />
                      Customize
                    </motion.button>
                  )}
                </div>
              )}

              <motion.button
                type="button"
                disabled={soldOut}
                onClick={handlePrimaryAction}
                whileTap={soldOut ? undefined : { scale: 0.98 }}
                transition={pressSpring}
                aria-label={
                  soldOut
                    ? `${item.name} is gone for today`
                    : `Add ${item.name} to order, €${item.base_price.toFixed(2)}`
                }
                className={cn(
                  "ml-auto flex h-10 items-center rounded-full px-6 font-mono text-[11px] font-medium tracking-[0.14em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                  soldOut
                    ? "cursor-default bg-surface-muted text-text-tertiary"
                    : "bg-accent-primary text-surface-card hover:bg-accent-hover",
                )}
              >
                {soldOut ? "Gone for today" : hasModifiers ? "Configure & Add" : `Add to order — €${item.base_price.toFixed(2)}`}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
