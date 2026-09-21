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
    <ul className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
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
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className={cn(
                  "object-cover",
                  reduced ? "transition-none" : "transition-transform duration-500 group-hover:scale-105",
                )}
              />

              {soldOut && (
                <span className="absolute left-3 top-3 rounded-full bg-surface-canvas/90 px-3 py-1 font-mono text-[10px] font-medium tracking-[0.14em] text-badge-alert uppercase backdrop-blur-sm">
                  Gone for today
                </span>
              )}
              {lowStock && (
                <span className="absolute left-3 top-3 rounded-full bg-surface-canvas/90 px-3 py-1 font-mono text-[10px] font-medium tracking-[0.14em] text-badge-alert uppercase backdrop-blur-sm">
                  Only {item.daily_stock} left
                </span>
              )}

              {item.tasting_notes && item.tasting_notes.length > 0 && (
                <p className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-3 gap-y-1 bg-linear-to-t from-text-primary/80 to-transparent p-4 pt-10 font-mono text-[10px] font-medium tracking-[0.14em] text-white uppercase">
                  {item.tasting_notes.slice(0, 2).map((note, index) => (
                    <span key={note} className="flex items-center gap-3">
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

            <div className="mt-4 flex items-baseline justify-between gap-3">
              <h3
                className={cn(
                  "font-serif text-[22px] leading-[1.05] tracking-[-0.02em]",
                  soldOut ? "text-text-tertiary" : "text-text-primary",
                )}
              >
                {item.name}
              </h3>
              <span
                className={cn(
                  "shrink-0 font-mono text-[14px] font-medium tabular-nums",
                  soldOut ? "text-text-tertiary" : "text-text-primary",
                )}
              >
                €{item.base_price.toFixed(2)}
              </span>
            </div>

            {parts.length > 0 && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] font-medium tracking-[0.14em] text-text-secondary uppercase">
                {parts.map((part, index) => (
                  <span key={part} className="flex items-center gap-3">
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

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenSpecimen(item)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-3.5 font-mono text-[10px] font-medium tracking-[0.16em] text-text-primary uppercase transition-colors duration-300 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                aria-label={`View specimen details for ${item.name}`}
              >
                <Eye aria-hidden size={13} strokeWidth={2} />
                Inspect
              </button>

              <button
                type="button"
                disabled={soldOut}
                onClick={() => onAdd(item)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-text-primary px-3.5 font-mono text-[10px] font-medium tracking-[0.16em] text-surface-canvas uppercase transition-colors duration-300 hover:bg-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-default disabled:opacity-40"
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
