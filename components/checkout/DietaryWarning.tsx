"use client";

import { motion, useReducedMotion } from "framer-motion";

import { conflicts, hasPrefs, passLine, type DietaryPrefs, type ItemDietary } from "@/lib/dietary";
import { glide } from "@/lib/reveal";
import type { CartLine } from "@/lib/cart";

export type DietaryIndex = Record<string, ItemDietary>;

type Flagged = { id: string; name: string; reasons: string[] };

export function flaggedLines(
  lines: CartLine[],
  prefs: DietaryPrefs,
  index: DietaryIndex,
): Flagged[] {
  if (!hasPrefs(prefs)) return [];

  return lines.flatMap((line) => {
    const item = index[line.menuItemId];
    if (!item) return [];
    const reasons = conflicts(item, prefs, line.selectedModifiers);
    return reasons.length ? [{ id: line.id, name: line.name, reasons }] : [];
  });
}

export function DietaryWarning({ flagged, prefs }: { flagged: Flagged[]; prefs: DietaryPrefs }) {
  const reduced = useReducedMotion();

  if (flagged.length === 0) return null;

  const count = flagged.length;

  return (
    <motion.aside
      role="status"
      aria-label="Order check"
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={glide}

      className="-mx-5 border-y border-hairline bg-accent-subtle px-5 py-8 sm:-mx-10 sm:px-10 lg:-mx-14 lg:px-14"
    >
      <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-badge-alert uppercase">
        {count === 1 ? "One thing does not match" : `${count} things do not match`}
      </p>

      {}
      <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
        {flagged.map((line) => (
          <li key={line.id} className="py-4">
            <span className="block font-serif text-[22px] leading-[1.05] tracking-[-0.02em] text-text-primary">
              {line.name}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] font-medium tracking-[0.14em] text-badge-alert uppercase">
              {line.reasons.map((reason, index) => (
                <span key={reason} className="flex items-center gap-3">
                  {index > 0 && (
                    <span aria-hidden className="text-hairline">
                      /
                    </span>
                  )}
                  {reason}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 max-w-lg text-[15px] leading-[1.55] text-text-secondary">
        Checked against {passLine(prefs).join(" / ").toLowerCase()} from your settings.
        Order it anyway if you meant to — nothing here stops you.
      </p>
    </motion.aside>
  );
}
