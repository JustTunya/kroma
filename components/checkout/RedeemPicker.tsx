"use client";

import { motion } from "framer-motion";

import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type RedeemOption = { menuItemId: string; name: string };

export function RedeemPicker({
  options,
  value,
  onChange,
}: {
  options: RedeemOption[];
  value: string | null;
  onChange: (menuItemId: string | null) => void;
}) {
  return (
    <fieldset className="border-y border-hairline py-8">
      <legend className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
        Card full
      </legend>
      <p className="mt-3 font-serif text-[22px] leading-[1.05] tracking-[-0.02em] text-text-primary">
        Pick your free drink.
      </p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = value === option.menuItemId;
          return (
            <motion.button
              key={option.menuItemId}
              type="button"
              onClick={() => onChange(option.menuItemId)}
              whileTap={{ scale: 0.98 }}
              transition={pressSpring}
              aria-pressed={active}
              aria-label={`Redeem the card for ${option.name}`}
              className={cn(
                "relative flex h-9 shrink-0 items-center rounded-full px-4 font-mono text-[10px] font-medium tracking-[0.16em] whitespace-nowrap uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                active ? "text-surface-card" : "text-text-tertiary",
              )}
            >
              {active && (
                <motion.span
                  layoutId="activeRedeemOption"
                  transition={spring}
                  className="absolute inset-0 rounded-full bg-accent-primary"
                  aria-hidden
                />
              )}
              <span className="relative">{option.name}</span>
            </motion.button>
          );
        })}

        <motion.button
          type="button"
          onClick={() => onChange(null)}
          whileTap={{ scale: 0.98 }}
          transition={pressSpring}
          aria-pressed={value === null}
          className={cn(
            "relative flex h-9 shrink-0 items-center rounded-full px-4 font-mono text-[10px] font-medium tracking-[0.16em] whitespace-nowrap uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
            value === null ? "text-surface-canvas" : "text-text-tertiary",
          )}
        >
          {value === null && (
            <motion.span
              layoutId="activeRedeemOption"
              transition={spring}
              className="absolute inset-0 rounded-full bg-text-primary"
              aria-hidden
            />
          )}
          <span className="relative">Not this time</span>
        </motion.button>
      </div>
    </fieldset>
  );
}
