"use client";

import { motion } from "framer-motion";
import { pressSpring } from "@/lib/motion";

export function ShiftStart({
  onStart,
  error,
}: {
  onStart: () => void;
  error?: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-kds-canvas px-5">
      <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
        No shift open
      </p>

      <motion.button
        type="button"
        onClick={onStart}
        whileTap={{ scale: 0.98 }}
        transition={pressSpring}
        className="flex h-12 items-center rounded-full bg-accent-primary px-8 font-mono text-[11px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kds-text-primary"
      >
        Start shift
      </motion.button>

      {error && (
        <p
          role="status"
          className="font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase"
        >
          {error}
        </p>
      )}
    </div>
  );
}
