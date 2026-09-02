"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

import { pressSpring } from "@/lib/motion";
import { useCart } from "@/lib/use-cart";
import { cn } from "@/lib/utils";
import type { CartLine } from "@/lib/cart";

const VARIANTS = {

  pill: "flex h-10 items-center rounded-full bg-accent-primary px-5 text-surface-card transition-colors hover:bg-accent-hover disabled:bg-surface-muted disabled:text-text-tertiary",

  inline:
    "text-accent-primary transition-colors hover:text-accent-hover disabled:text-text-tertiary",
} as const;

export function ReorderButton({
  lines,
  unavailable = [],
  label = "Order again",
  variant = "pill",
}: {
  lines: CartLine[];
  unavailable?: string[];
  label?: string;
  variant?: keyof typeof VARIANTS;
}) {
  const router = useRouter();
  const { add, ready } = useCart(true);
  const [busy, setBusy] = useState(false);

  if (lines.length === 0) {
    return (
      <p className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-badge-alert">
        Gone for today
      </p>
    );
  }

  return (
    <div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        transition={pressSpring}
        disabled={!ready || busy}
        onClick={() => {
          setBusy(true);
          for (const line of lines) add(line);
          router.push("/checkout");
        }}
        className={cn(
          "font-mono text-[11px] font-medium tracking-[0.14em] uppercase",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
          VARIANTS[variant],
        )}
      >
        {label}
      </motion.button>

      {unavailable.length > 0 && (
        <p className="mt-3 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-badge-alert">
          {unavailable.length === 1
            ? "One line is gone for today"
            : `${unavailable.length} lines are gone for today`}
        </p>
      )}
    </div>
  );
}
