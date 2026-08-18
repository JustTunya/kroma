"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";

import { numberTransition, pressSpring } from "@/lib/motion";

type QtyStepperProps = {
  quantity: number;
  onChange: (next: number) => void;
  label: string;
  min?: number;
};

export function QtyStepper({ quantity, onChange, label, min = 1 }: QtyStepperProps) {
  return (
    <div className="flex items-center gap-3">
      <motion.button
        type="button"
        onClick={() => onChange(quantity - 1)}
        disabled={quantity <= min}
        whileTap={{ scale: 0.98 }}
        transition={pressSpring}
        aria-label={`Decrease ${label} quantity`}
        className="flex size-8 items-center justify-center rounded-full border border-hairline text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:text-text-tertiary disabled:opacity-50"
      >
        <Minus aria-hidden size={14} strokeWidth={2} />
      </motion.button>

      <div className="w-5 overflow-hidden text-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={quantity}
            {...numberTransition}
            className="block font-mono text-[15px] font-medium tabular-nums text-text-primary"
          >
            {quantity}
          </motion.span>
        </AnimatePresence>
      </div>

      <motion.button
        type="button"
        onClick={() => onChange(quantity + 1)}
        whileTap={{ scale: 0.98 }}
        transition={pressSpring}
        aria-label={`Increase ${label} quantity`}
        className="flex size-8 items-center justify-center rounded-full border border-hairline text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      >
        <Plus aria-hidden size={14} strokeWidth={2} />
      </motion.button>
    </div>
  );
}
