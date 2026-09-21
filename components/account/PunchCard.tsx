"use client";

import { motion, useReducedMotion } from "framer-motion";

import { glide } from "@/lib/reveal";
import { cn } from "@/lib/utils";

const CARD_LENGTH = 10;

// Small text on the dark band uses the light tokens: terracotta is graphics-only there (3.5:1).
export function PunchCard({ punches }: { punches: number }) {
  const reduced = useReducedMotion();
  const filled = Math.max(0, Math.min(punches, CARD_LENGTH));
  const left = CARD_LENGTH - filled;
  const cardFull = left === 0;

  return (
    <div>
      <p
        className={cn(
          "font-serif text-[clamp(32px,4vw,56px)] leading-[1.05] tracking-[-0.02em]",
          cardFull ? "text-accent-primary" : "text-surface-canvas",
        )}
      >
        {cardFull ? "Card full." : `${left} to go.`}
      </p>

      <motion.ol
        role="img"
        aria-label={`${filled} of ${CARD_LENGTH} punches`}
        initial={reduced ? false : "hidden"}
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.5 } } }}
        className="mt-7 grid max-w-md grid-cols-5 gap-2.5 sm:gap-3.5"
      >
        {Array.from({ length: CARD_LENGTH }, (_, i) => {
          const isFilled = i < filled;
          const isLatest = i === filled - 1;

          return (
            <motion.li
              key={i}
              variants={{
                hidden: { opacity: 0, scale: 0.4 },
                visible: { opacity: 1, scale: 1 },
              }}
              transition={glide}
              className={cn(
                "flex aspect-square items-center justify-center rounded-full border font-mono text-[11px] font-medium tabular-nums",
                isFilled
                  ? isLatest
                    ? "border-accent-primary bg-accent-primary text-text-primary"
                    : "border-surface-canvas bg-surface-canvas text-text-primary"
                  : "border-kds-border text-kds-text-secondary",
              )}
            >
              {i + 1}
            </motion.li>
          );
        })}
      </motion.ol>

      <p
        role="status"
        className="mt-5 font-mono text-[11px] font-medium tracking-[0.14em] text-kds-text-secondary uppercase"
      >
        {cardFull
          ? "One drink on us — pick it at checkout"
          : `${filled} ${filled === 1 ? "cup" : "cups"} in / one on us at ten`}
      </p>
    </div>
  );
}
