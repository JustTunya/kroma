"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

export type MarqueeEntry = { label: string; alert?: boolean };

function Run({ entries }: { entries: MarqueeEntry[] }) {
  return (
    <div className="flex shrink-0 items-center">
      {entries.map((entry, index) => (
        <span key={`${entry.label}-${index}`} className="flex items-center">
          <span
            className={cn(
              "whitespace-nowrap",
              entry.alert ? "text-badge-alert" : "text-text-secondary",
            )}
          >
            {entry.label}
          </span>
          <span aria-hidden className="px-5 text-hairline">
            /
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * A mono-uppercase running strip between two hairlines. Rendered twice side by
 * side so the loop point never shows a seam; reduced motion turns it into a
 * plain horizontally scrollable strip instead of stopping it dead.
 */
export function Marquee({
  entries,
  label,
  duration = 70,
}: {
  entries: MarqueeEntry[];
  label: string;
  duration?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <section aria-label={label} className="border-y border-hairline bg-surface-canvas">
      <div
        className={cn(
          "flex h-12 items-center font-mono text-[11px] font-medium tracking-[0.14em] uppercase",
          reduced ? "scrollbar-hide overflow-x-auto px-5" : "overflow-hidden",
        )}
      >
        <motion.div
          className="flex w-max"
          animate={reduced ? undefined : { x: ["0%", "-50%"] }}
          transition={{ duration, ease: "linear", repeat: Infinity }}
        >
          <Run entries={entries} />
          {!reduced && (
            <div aria-hidden>
              <Run entries={entries} />
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
