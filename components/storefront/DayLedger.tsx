"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/menu";

type Entry = { label: string; alert?: boolean };

/** The day as the bakehouse actually runs it: hours, plus what is left of each batch. */
function ledger(items: MenuItem[]): Entry[] {
  const batches = items
    .filter((item) => item.daily_stock !== null)
    .map<Entry>((item) => {
      const stock = item.daily_stock as number;

      if (stock === 0) return { label: `${item.name} — gone for today`, alert: true };

      return { label: `${item.name} — ${stock} left`, alert: stock <= 5 };
    });

  return [
    { label: "07:30 doors open" },
    { label: "08:00 first bake" },
    ...batches,
    { label: "15:00 last bake" },
    { label: "18:00 close" },
  ];
}

function Run({ entries }: { entries: Entry[] }) {
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

export function DayLedger({ items }: { items: MenuItem[] }) {
  const reduced = useReducedMotion();
  const entries = ledger(items);

  return (
    <section
      aria-label="Today at the bakehouse"
      className="border-y border-hairline bg-surface-canvas"
    >
      <div
        className={cn(
          "flex h-12 items-center font-mono text-[11px] font-medium tracking-[0.14em] uppercase",
          reduced ? "overflow-x-auto scrollbar-hide px-5" : "overflow-hidden",
        )}
      >
        <motion.div
          className="flex w-max"
          animate={reduced ? undefined : { x: ["0%", "-50%"] }}
          transition={{ duration: 70, ease: "linear", repeat: Infinity }}
        >
          <Run entries={entries} />
          {!reduced && (
            /* Second copy so the loop point never shows a gap. */
            <div aria-hidden>
              <Run entries={entries} />
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
