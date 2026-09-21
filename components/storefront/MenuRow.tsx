"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Eye, Fish, Leaf, Sprout, WheatOff } from "lucide-react";

import type { Transition } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/menu";

// ponytail: onOpenSpecimen is optional with a no-op default because
// Storefront.tsx doesn't wire the specimen drawer handler through until
// Task 9. Make it required once that task lands.
type MenuRowProps = {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;

  onPreview: (item: MenuItem) => void;
  onOpenSpecimen?: (item: MenuItem) => void;
};

const noop = () => {};

const rowExit: Transition = { duration: 0.12, ease: "easeOut" };

function spec(item: MenuItem): string[] {
  return [item.origin, item.process, item.roast].filter(
    (part): part is string => Boolean(part),
  );
}

const dietaryIcons: Record<string, LucideIcon> = {
  Vegan: Leaf,
  Vegetarian: Sprout,
  Pescatarian: Fish,
  "Gluten-Free": WheatOff,
};

export function MenuRow({ item, onAdd, onPreview, onOpenSpecimen = noop }: MenuRowProps) {
  const reduced = useReducedMotion();
  const soldOut = item.daily_stock === 0;
  const lowStock =
    item.daily_stock !== null && item.daily_stock > 0 && item.daily_stock <= 5;

  return (
    <motion.li
      layout={reduced ? false : "position"}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: reduced ? { duration: 0 } : spring }}
      exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: rowExit }}
      transition={reduced ? { duration: 0 } : { layout: spring }}
    >
      <motion.button
        type="button"
        disabled={soldOut}
        onClick={() => onAdd(item)}
        onPointerEnter={() => onPreview(item)}
        onFocus={() => onPreview(item)}
        whileHover={soldOut || reduced ? undefined : "hover"}
        whileFocus={soldOut || reduced ? undefined : "hover"}
        whileTap={soldOut || reduced ? undefined : { scale: 0.995 }}
        transition={pressSpring}
        aria-label={
          soldOut
            ? `${item.name} — gone for today`
            : `Add ${item.name} to order, €${item.base_price.toFixed(2)}`
        }
        className="group flex w-full flex-col gap-5 py-7 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus sm:py-9 lg:flex-row lg:items-start lg:gap-6 disabled:cursor-default"
      >
        <div
          className={cn(
            "relative aspect-4/3 w-full shrink-0 overflow-hidden border border-border-subtle bg-surface-muted shadow-card lg:hidden",
            soldOut && "grayscale",
          )}
        >
          <Image
            src={item.image_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 0px, 100vw"
            loading="eager"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-5">
            <motion.h3
              variants={{ hover: { x: 10 } }}
              transition={spring}
              className={cn(
                "font-serif text-[clamp(28px,3.2vw,44px)] leading-[1.05] tracking-[-0.02em]",
                soldOut ? "text-text-tertiary" : "text-text-primary",
              )}
            >
              {item.name}
            </motion.h3>

            <span
              className={cn(
                "shrink-0 font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums",
                soldOut ? "text-text-tertiary" : "text-text-primary",
              )}
            >
              €{item.base_price.toFixed(2)}
            </span>
          </div>

          {item.description && (
            <motion.p
              variants={{ hover: { x: 10 } }}
              transition={spring}
              className="mt-2.5 max-w-lg text-[15px] leading-[1.55] text-text-secondary"
            >
              {item.description}
            </motion.p>
          )}

          {item.tasting_notes && item.tasting_notes.length > 0 && (
            <motion.p
              variants={{ hover: { x: 10 } }}
              transition={spring}
              className={cn(
                "mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] font-medium tracking-[0.14em] uppercase",
                soldOut ? "text-text-tertiary" : "text-accent-primary",
              )}
            >
              {item.tasting_notes.map((note, index) => (
                <span key={note} className="flex items-center gap-3">
                  {index > 0 && (
                    <span aria-hidden className="text-hairline">
                      /
                    </span>
                  )}
                  {note}
                </span>
              ))}
            </motion.p>
          )}

          <motion.div
            variants={{ hover: { x: 10 } }}
            transition={spring}
            className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] font-medium tracking-[0.14em] text-text-secondary uppercase"
          >
            {spec(item).map((part, index) => (
              <span key={part} className="flex items-center gap-3">
                {index > 0 && (
                  <span aria-hidden className="text-hairline">
                    /
                  </span>
                )}
                {part}
              </span>
            ))}

            {item.dietary_tags.map((tag, index) => {
              const Icon = dietaryIcons[tag];
              return (
                <span key={tag} className="flex items-center gap-3">
                  {(index > 0 || spec(item).length > 0) && (
                    <span aria-hidden className="text-hairline">
                      /
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    {Icon && <Icon aria-hidden size={12} strokeWidth={2} />}
                    {tag}
                  </span>
                </span>
              );
            })}

            {soldOut && <span className="text-badge-alert">Gone for today</span>}
            {lowStock && (
              <span className="text-badge-alert">Only {item.daily_stock} left</span>
            )}

            {!soldOut && (

              <span
                aria-hidden
                className="text-accent-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                + Add
              </span>
            )}
          </motion.div>
        </div>
      </motion.button>

      <button
        type="button"
        onClick={() => onOpenSpecimen(item)}
        className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full px-1 font-mono text-[10px] font-medium tracking-[0.16em] text-text-tertiary uppercase transition-colors duration-300 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        aria-label={`View specimen details for ${item.name}`}
      >
        <Eye aria-hidden size={13} strokeWidth={2} />
        View Specimen
      </button>
    </motion.li>
  );
}
