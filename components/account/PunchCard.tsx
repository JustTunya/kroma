"use client";

import { motion, useReducedMotion } from "framer-motion";

import { glide } from "@/lib/reveal";
import { cn } from "@/lib/utils";

const CARD_LENGTH = 12;

/** Filled, empty and status colours per surface. Dark is the inverted band. */
const TONES = {
  canvas: {
    filled: "text-text-primary",
    empty: "text-hairline",
    status: "text-text-secondary",
    rule: "text-hairline",
    headline: "text-text-primary",
  },
  dark: {
    filled: "text-surface-canvas",
    empty: "text-kds-border",
    status: "text-kds-text-secondary",
    rule: "text-kds-border",
    headline: "text-surface-canvas",
  },
} as const;

/**
 * Twelve glyphs on a row. Deliberately not a progress bar: the whole point of a
 * card is that you can count what is left at a glance. The last earned punch
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

  return (
    <div>
      {headline && (
        <p
          className={cn(
            "font-serif text-[clamp(28px,3.2vw,44px)] leading-[1.05] tracking-[-0.02em]",
            left === 0 ? "text-accent-primary" : colors.headline,
          )}
        >
          {left === 0 ? "Card full." : `${left} to go.`}
        </p>
      )}

      <motion.p
        aria-hidden
        initial={reduced ? false : "hidden"}
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
        className={cn(
          "flex leading-none",
          headline && "mt-6",
          size === "lg" ? "gap-3 text-[28px]" : "gap-2 text-[15px]",
        )}
      >
        {Array.from({ length: CARD_LENGTH }, (_, i) => (
          <motion.span
            key={i}
            variants={{
              hidden: { opacity: 0, scale: 0.6 },
              visible: { opacity: 1, scale: 1 },
            }}
            transition={glide}
            className={
              i < filled
                ? i === filled - 1
                  ? "text-accent-primary"
                  : colors.filled
                : colors.empty
            }
          >
            {i < filled ? "●" : "○"}
          </motion.span>
        ))}
      </motion.p>

      <p
        role="status"
        className={cn(
          "mt-4 font-mono text-[11px] font-medium tracking-[0.14em] uppercase",
          colors.status,
        )}
      >
        {left === 0 && !headline ? (
          <span className="text-accent-primary">
            Card full — one drink on us, pick it at checkout
          </span>
        ) : left === 0 ? (
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
