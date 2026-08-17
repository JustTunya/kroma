"use client";

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { ShoppingBag } from "lucide-react";

import { numberTransition, pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

type StorefrontHeaderProps = {
  cartCount: number;
  onCartOpen?: () => void;
};

export function StorefrontHeader({ cartCount, onCartOpen }: StorefrontHeaderProps) {
  const hasItems = cartCount > 0;
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const [onCanvas, setOnCanvas] = useState(false);

  // The header rides over the hero photograph until the canvas comes up to meet it.
  useMotionValueEvent(scrollY, "change", (value) => {
    setOnCanvas(value > window.innerHeight * 0.7);
  });

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-colors duration-300",
        onCanvas
          ? "border-b border-hairline bg-surface-canvas/85 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="flex h-16 w-full items-center justify-between gap-4 px-5 sm:px-10 lg:px-14">
        <div className="flex items-baseline gap-2.5">
          <span
            className={cn(
              "font-serif text-[26px] leading-none tracking-[-0.02em] transition-colors duration-300",
              onCanvas ? "text-text-primary" : "text-surface-canvas",
            )}
          >
            KROMA
          </span>
          <span
            className={cn(
              "hidden font-mono text-[10px] font-medium tracking-[0.18em] uppercase transition-colors duration-300 sm:inline",
              onCanvas ? "text-text-tertiary" : "text-surface-canvas/60",
            )}
          >
            Coffee &amp; Bakehouse
          </span>
        </div>

        <p
          className={cn(
            "flex items-center gap-2.5 font-mono text-[10px] font-medium tracking-[0.18em] uppercase transition-colors duration-300",
            onCanvas ? "text-text-secondary" : "text-surface-canvas/75",
          )}
        >
          <motion.span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-badge-live"
            animate={reduced ? undefined : { opacity: [1, 0.25, 1] }}
            transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
          />
          <span className="hidden sm:inline">Brewing now — 8–12 min</span>
          <span className="sm:hidden">8–12 min</span>
        </p>

        <motion.button
          type="button"
          onClick={onCartOpen}
          whileTap={{ scale: 0.98 }}
          transition={pressSpring}
          aria-label={`Open order${hasItems ? ` — ${cartCount} items` : ""}`}
          className={cn(
            "flex h-10 min-w-10 items-center justify-center gap-2 rounded-full px-3.5 transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
            hasItems
              ? "bg-accent-primary text-surface-card hover:bg-accent-hover"
              : onCanvas
                ? "bg-surface-muted text-text-primary"
                : "bg-surface-canvas/15 text-surface-canvas backdrop-blur-sm",
          )}
        >
          <ShoppingBag className="size-[18px]" strokeWidth={1.5} aria-hidden />
          <AnimatePresence mode="popLayout" initial={false}>
            {hasItems && (
              <motion.span
                key={cartCount}
                {...numberTransition}
                transition={spring}
                className="font-mono text-[12px] font-medium tracking-[0.02em] tabular-nums"
              >
                {cartCount}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </header>
  );
}
