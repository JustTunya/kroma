"use client";

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import Link from "next/link";
import { ShoppingBag, UserRound } from "lucide-react";

import { pickupCountdown } from "@/lib/active-order";
import { numberTransition, pressSpring, spring } from "@/lib/motion";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { glide } from "@/lib/reveal";
import { useActiveOrder } from "@/lib/use-active-order";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/Logo";

// motion.create wraps the anchor itself — a motion.div wrapper here would add
// its own tabIndex (Framer Motion makes tap-gesture elements keyboard
// operable), giving "Sign in" two consecutive stops in the tab order for one
// link.
const MotionLink = motion.create(Link);

type StorefrontHeaderProps = {
  cartCount: number;
  signedIn: boolean;
  onCartOpen?: () => void;
};

export function StorefrontHeader({
  cartCount,
  signedIn,
  onCartOpen,
}: StorefrontHeaderProps) {
  const hasItems = cartCount > 0;
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const [onCanvas, setOnCanvas] = useState(false);
  const active = useActiveOrder(signedIn);

  // The bar's own wording for the state, then the minutes left. A ready order
  // has no minutes — it is waiting, and the compact pill says so on its own.
  const statusText = active ? ORDER_STATUS_LABELS[active.status].text : null;
  const countdown = active
    ? pickupCountdown(active.status, active.pickup_at)
    : null;

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
      <div className="relative flex h-16 w-full items-center justify-between gap-4 px-5 sm:px-10 lg:px-14">
        <div className="flex items-baseline gap-2.5">
          <Wordmark
            className={cn(
              "font-serif text-[26px] leading-none tracking-[-0.02em] transition-colors duration-300",
              onCanvas ? "text-text-primary" : "text-surface-canvas",
            )}
          />
          <span
            className={cn(
              "hidden font-mono text-[10px] font-medium tracking-[0.18em] uppercase transition-colors duration-300 sm:inline",
              onCanvas ? "text-text-tertiary" : "text-surface-canvas/60",
            )}
          >
            Coffee &amp; Bakehouse
          </span>
        </div>

        <AnimatePresence>
          {active && (
            <>
              <motion.p
                key="order-status-wide"
                role="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={glide}
                className={cn(
                  "absolute left-1/2 hidden -translate-x-1/2 items-center gap-2.5 rounded-full border px-3.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.18em] text-accent-primary uppercase shadow-float backdrop-blur-md transition-colors duration-300 sm:flex",
                  onCanvas
                    ? "border-accent-primary/75 bg-accent-subtle"
                    : "border-accent-primary bg-accent-subtle/20",
                )}
              >
                <motion.span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full bg-accent-primary"
                  animate={reduced ? undefined : { opacity: [1, 0.25, 1] }}
                  transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
                />
                <span className="text-shadow-text-primary/10 text-shadow-2xs">
                  {statusText}
                  {countdown && ` — ${countdown}`}
                </span>
              </motion.p>
              <motion.p
                key="order-status-compact"
                role="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={glide}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.18em] text-accent-primary uppercase shadow-float backdrop-blur-sm transition-colors duration-300 sm:hidden",
                  onCanvas
                    ? "border-accent-primary/75 bg-accent-subtle"
                    : "border-accent-primary/75 bg-accent-subtle/15",
                )}
              >
                <motion.span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full bg-accent-primary"
                  animate={reduced ? undefined : { opacity: [1, 0.25, 1] }}
                  transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
                />
                <span className="text-shadow-text-primary/10 text-shadow-2xs">
                  {countdown ?? statusText}
                </span>
              </motion.p>
            </>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <MotionLink
            href={signedIn ? "/account" : "/auth/login"}
            aria-label={signedIn ? "Your account" : "Sign in to your account"}
            whileTap={{ scale: 0.98 }}
            transition={pressSpring}
            className={cn(
              "flex h-10 min-w-10 items-center justify-center gap-2 rounded-full px-3.5 transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
              onCanvas
                ? "bg-surface-muted text-text-primary"
                : "bg-surface-canvas/15 text-surface-canvas backdrop-blur-sm",
            )}
          >
            <UserRound className="size-4.5" strokeWidth={1.5} aria-hidden />
            {!signedIn && (
              <span className="hidden font-mono text-[10px] font-medium tracking-[0.18em] uppercase sm:inline">
                Sign in
              </span>
            )}
          </MotionLink>

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
            <ShoppingBag className="size-4.5" strokeWidth={1.5} aria-hidden />
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
      </div>
    </header>
  );
}
