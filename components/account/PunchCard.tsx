"use client";

import { motion, useReducedMotion } from "framer-motion";

import { glide } from "@/lib/reveal";
import { cn } from "@/lib/utils";

const CARD_LENGTH = 10;

/** Fill, empty-ring and status colours per surface. Dark is the inverted band. */
const TONES = {
  canvas: {
    filledBg: "bg-text-primary",
    emptyRing: "border-hairline",
    status: "text-text-secondary",
    rule: "text-hairline",
    headline: "text-text-primary",
  },
  dark: {
    filledBg: "bg-surface-canvas",
    emptyRing: "border-kds-border",
    status: "text-kds-text-secondary",
    rule: "text-kds-border",
    headline: "text-surface-canvas",
  },
} as const;

/**
 * Ten identical cells. Deliberately not a progress bar: the point of a card
 * is that you can count what is left at a glance. The last earned punch
 * carries the accent so the eye lands on where you are, not on the row.
 */
export function PunchCard({
  punches,
  size = "sm",
  tone = "canvas",
  headline = false,
}: {
  punches: number;
  size?: "sm" | "lg";
  tone?: keyof typeof TONES;
  /** Puts what is left at display size — the goal only pulls while it is visible. */
  headline?: boolean;
}) {
  const reduced = useReducedMotion();
  const colors = TONES[tone];
  const filled = Math.max(0, Math.min(punches, CARD_LENGTH));
  const left = CARD_LENGTH - filled;
  const cardFull = left === 0;

  const dot = size === "lg" ? "size-3.5" : "size-2.5";
  const gap = size === "lg" ? "gap-3" : "gap-2";

  return (
    <div>
      {headline && (
        <p
          className={cn(
            "font-serif text-[clamp(28px,3.2vw,44px)] leading-[1.05] tracking-[-0.02em]",
            cardFull ? "text-accent-primary" : colors.headline,
          )}
        >
          {cardFull ? "Card full." : `${left} to go.`}
        </p>
      )}

      <motion.div
        aria-hidden
        initial={reduced ? false : "hidden"}
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
        className={cn("flex items-center", gap, headline && "mt-7")}
      >
        {Array.from({ length: CARD_LENGTH }, (_, i) => {
          const isFilled = i < filled;
          const isLatest = i === filled - 1;

          return (
            <motion.span
              key={i}
              variants={{
                hidden: { opacity: 0, scale: 0.4 },
                visible: { opacity: 1, scale: 1 },
              }}
              transition={glide}
              className={cn(
                "shrink-0 rounded-full",
                dot,
                isFilled
                  ? isLatest
                    ? "bg-accent-primary"
                    : colors.filledBg
                  : cn("border", colors.emptyRing),
              )}
            />
          );
        })}
      </motion.div>

      <p
        role="status"
        className={cn(
          "mt-4 font-mono text-[11px] font-medium tracking-[0.14em] uppercase",
          colors.status,
        )}
      >
        {cardFull && !headline ? (
          <span className="text-accent-primary">
            Card full — one drink on us, pick it at checkout
          </span>
        ) : cardFull ? (
          <span className="text-accent-primary">One drink on us, pick it at checkout</span>
        ) : (
          <>
            {filled} {filled === 1 ? "cup" : "cups"} in
            {!headline && (
              <>
                <span aria-hidden className={cn("mx-3", colors.rule)}>
                  /
                </span>
                {left} to go
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}
