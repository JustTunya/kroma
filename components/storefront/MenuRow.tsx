"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Fish, Leaf, Sprout, WheatOff } from "lucide-react";

import type { Transition } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/menu";

type MenuRowProps = {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
  /** Raises the item into the preview slot on hover or keyboard focus. */
  onPreview: (item: MenuItem) => void;
};

/** Exit: fades out on the spot instead of gating the reflow behind its own spring. */
const rowExit: Transition = { duration: 0.12, ease: "easeOut" };

/** Origin, process and roast, in the order a spec sheet would list them. */
function spec(item: MenuItem): string[] {
  return [item.origin, item.process, item.roast].filter(
    (part): part is string => Boolean(part),
  );
}

/** Icon shown before each dietary tag. Falls back to no icon for unlisted tags. */
const dietaryIcons: Record<string, LucideIcon> = {
  Vegan: Leaf,
  Vegetarian: Sprout,
  Pescatarian: Fish,
  "Gluten-Free": WheatOff,
};

export function MenuRow({ item, onAdd, onPreview }: MenuRowProps) {
  const soldOut = item.daily_stock === 0;
  const lowStock =
    item.daily_stock !== null && item.daily_stock > 0 && item.daily_stock <= 5;

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: spring }}
      exit={{ opacity: 0, transition: rowExit }}
      transition={{ layout: spring }}
    >
      <motion.button
        type="button"
        disabled={soldOut}
        onClick={() => onAdd(item)}
        onPointerEnter={() => onPreview(item)}
        onFocus={() => onPreview(item)}
        whileHover={soldOut ? undefined : "hover"}
        whileFocus={soldOut ? undefined : "hover"}
        whileTap={soldOut ? undefined : { scale: 0.995 }}
        transition={pressSpring}
        aria-label={
          soldOut
            ? `${item.name} — gone for today`
            : `Add ${item.name} to order, €${item.base_price.toFixed(2)}`
        }
        className="group flex w-full items-start gap-4 py-7 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus sm:gap-6 sm:py-9 disabled:cursor-default"
      >
        <div
          className={cn(
            "relative size-20 shrink-0 overflow-hidden rounded-sm bg-surface-muted lg:hidden",
            soldOut && "grayscale",
          )}
        >
          <Image
            src={item.image_url}
            alt=""
            fill
            sizes="80px"
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

          <motion.div
            variants={{ hover: { x: 10 } }}
            transition={spring}
            className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase"
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
              /* Plain CSS: a variant here would fight the row's entrance state. */
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
    </motion.li>
  );
}
