"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Eye } from "lucide-react";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/menu";

type MenuLookbookProps = {
  items: MenuItem[];
  onAdd: (item: MenuItem) => void;
  onOpenSpecimen: (item: MenuItem) => void;
};

function spec(item: MenuItem): string[] {
  return [item.origin, item.process, item.roast].filter(
    (part): part is string => Boolean(part),
  );
}

export function MenuLookbook({ items, onAdd, onOpenSpecimen }: MenuLookbookProps) {
  const reduced = useReducedMotion();

  if (items.length === 0) {
    return (
      <p className="border-y border-hairline py-10 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
        Nothing on the pass in this section today.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-3">
      {items.map((item) => {
        const soldOut = item.daily_stock === 0;
        const lowStock =
          item.daily_stock !== null && item.daily_stock > 0 && item.daily_stock <= 5;
        const parts = spec(item);

        return (
          <motion.li
            key={item.id}
            className="group"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: reduced ? { duration: 0 } : spring }}
          >
            <div
              className={cn(
                "relative aspect-4/5 w-full overflow-hidden border border-border-subtle bg-surface-muted shadow-card",
                soldOut && "grayscale",
              )}
            >
              <Image
                src={item.image_url}
                alt=""
                fill
                sizes="(min-width: 1024px) 33vw, 50vw"
                className={cn(
                  "object-cover",
                  reduced ? "transition-none" : "transition-transform duration-500 group-hover:scale-105",
                )}
              />

              {soldOut && (
                <span className="absolute left-2 top-2 rounded-full bg-surface-canvas/90 px-2 py-0.5 font-mono text-[9px] font-medium tracking-[0.12em] text-badge-alert uppercase backdrop-blur-sm sm:left-3 sm:top-3 sm:px-3 sm:py-1 sm:text-[10px] sm:tracking-[0.14em]">
                  Gone for today
                </span>
              )}
              {lowStock && (
                <span className="absolute left-2 top-2 rounded-full bg-surface-canvas/90 px-2 py-0.5 font-mono text-[9px] font-medium tracking-[0.12em] text-badge-alert uppercase backdrop-blur-sm sm:left-3 sm:top-3 sm:px-3 sm:py-1 sm:text-[10px] sm:tracking-[0.14em]">
                  Only {item.daily_stock} left
                </span>
              )}

              {item.tasting_notes && item.tasting_notes.length > 0 && (
                <p className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-2 gap-y-1 bg-linear-to-t from-text-primary/80 to-transparent p-2.5 pt-8 font-mono text-[9px] font-medium tracking-[0.12em] text-white uppercase sm:gap-x-3 sm:p-4 sm:pt-10 sm:text-[10px] sm:tracking-[0.14em]">
                  {item.tasting_notes.slice(0, 2).map((note, index) => (
                    <span key={note} className="flex items-center gap-2 sm:gap-3">
                      {index > 0 && (
                        <span aria-hidden className="text-white/50">
                          /
                        </span>
                      )}
                      {note}
                    </span>
                  ))}
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-col justify-between gap-1 sm:mt-4 sm:flex-row sm:items-baseline sm:gap-3">
              <h3
                className={cn(
                  "font-serif text-[18px] leading-[1.1] tracking-[-0.02em] sm:text-[22px] sm:leading-[1.05]",
                  soldOut ? "text-text-tertiary" : "text-text-primary",
                )}
              >
                {item.name}
              </h3>
              <span
                className={cn(
                  "shrink-0 font-mono text-[13px] font-medium tabular-nums sm:text-[14px]",
                  soldOut ? "text-text-tertiary" : "text-text-primary",
                )}
              >
                €{item.base_price.toFixed(2)}
              </span>
            </div>

            {parts.length > 0 && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[9px] font-medium tracking-[0.12em] text-text-secondary uppercase sm:mt-1.5 sm:gap-x-3 sm:gap-y-1 sm:text-[10px] sm:tracking-[0.14em]">
                {parts.map((part, index) => (
                  <span key={part} className="flex items-center gap-2 sm:gap-3">
                    {index > 0 && (
                      <span aria-hidden className="text-hairline">
                        /
                      </span>
                    )}
                    {part}
                  </span>
                ))}
              </p>
            )}

            <div className="mt-4 flex items-center gap-2 sm:mt-5">
              <button
                type="button"
                onClick={() => onOpenSpecimen(item)}
                className="flex items-center justify-center gap-1 px-2 sm:px-6 h-10 rounded-full border border-hairline bg-surface-card font-mono text-[9px] sm:text-[11px] font-medium tracking-[0.12em] text-text-primary uppercase shadow-xs transition-colors duration-200 hover:border-border-subtle hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus active:scale-[0.98]"
                aria-label={`View specimen details for ${item.name}`}
              >
                <Eye aria-hidden size={14} strokeWidth={2} />
                Inspect
              </button>

              <button
                type="button"
                disabled={soldOut}
                onClick={() => onAdd(item)}
                className="flex-1 flex items-center justify-center gap-1 h-10 rounded-full bg-text-primary font-mono text-[9px] sm:text-[11px] font-semibold tracking-[0.12em] text-surface-canvas uppercase shadow-xs transition-colors duration-200 hover:bg-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-default disabled:opacity-40 active:scale-[0.98]"
                aria-label={
                  soldOut
                    ? `${item.name} — gone for today`
                    : `Add ${item.name} to order, €${item.base_price.toFixed(2)}`
                }
              >
                + Add
              </button>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
