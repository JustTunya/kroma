"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

import { pressSpring } from "@/lib/motion";
import { useCart } from "@/lib/use-cart";
import type { CartLine } from "@/lib/cart";

/**
 * Pushes past lines back into the live cart and sends the customer to checkout.
 * Lines whose item is gone for today are dropped, and said so plainly — the
 * alternative is a checkout that raises on a line the customer never chose.
 */
export function ReorderButton({
  lines,
  unavailable = [],
  label = "Order again",
}: {
  lines: CartLine[];
  unavailable?: string[];
  label?: string;
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
        className="flex h-10 items-center rounded-full bg-accent-primary px-5 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-surface-card transition-colors hover:bg-accent-hover disabled:bg-surface-muted disabled:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
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
