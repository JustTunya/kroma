"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { discountOrderAction } from "@/app/dashboard/actions";
import { previewDiscount, type DiscountKind } from "@/lib/discount";
import { numberTransition, pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { BoardOrder } from "@/types/board";

const PRESETS: { label: string; kind: DiscountKind; value: number }[] = [
  { label: "10%", kind: "percent", value: 10 },
  { label: "20%", kind: "percent", value: 20 },
  { label: "50%", kind: "percent", value: 50 },
  { label: "Comp", kind: "comp", value: 0 },
];

export function DiscountSheet({
  order,
  onClose,
}: {
  order: BoardOrder | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [preset, setPreset] = useState<number | null>(null);
  const [kind, setKind] = useState<DiscountKind>("percent");
  const [value, setValue] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!order) return null;

  const preview = previewDiscount(order.subtotal, kind, value);
  const canApply = reason.trim().length >= 3;

  function pick(index: number) {
    const p = PRESETS[index];
    setPreset(index);
    setKind(p.kind);
    setValue(p.value);
  }

  function apply() {
    if (!order || !canApply) return;
    setError(null);
    startTransition(async () => {
      const result = await discountOrderAction(order.id, kind, value, reason);
      if (result.ok) {
        setPreset(null);
        setValue(0);
        setReason("");
        onClose();
        router.refresh();
      } else {
        setError(result.error ?? "That did not go through.");
      }
    });
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-stretch justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          aria-hidden
          className="absolute inset-0 bg-text-primary/25 backdrop-blur-sm"
        />

        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Discount this order"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={spring}
          className="relative flex h-full w-full max-w-full flex-col overflow-y-auto bg-kds-canvas sm:w-105"
        >
          <div className="flex items-center justify-between gap-4 border-b border-kds-border p-6">
            <h2 className="font-serif text-[24px] leading-[1.05] tracking-[-0.02em]">
              Discount
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-kds-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              <X aria-hidden size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="flex-1 space-y-8 p-6">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p, i) => (
                <motion.button
                  key={p.label}
                  type="button"
                  onClick={() => pick(i)}
                  whileTap={{ scale: 0.98 }}
                  transition={pressSpring}
                  aria-pressed={preset === i}
                  className={cn(
                    "relative h-10 rounded-full px-5 font-mono text-[10px] font-medium tracking-[0.18em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
                    preset === i ? "text-kds-canvas" : "border border-kds-border text-kds-text-secondary",
                  )}
                >
                  {preset === i && (
                    <motion.span
                      layoutId="activeDiscount"
                      transition={spring}
                      className="absolute inset-0 rounded-full bg-kds-text-primary"
                      aria-hidden
                    />
                  )}
                  <span className="relative">{p.label}</span>
                </motion.button>
              ))}
            </div>

            <label className="block">
              <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
                Amount off (€)
              </span>
              <input
                type="number"
                min={0}
                step="0.10"
                value={kind === "amount" ? value : ""}
                onChange={(event) => {
                  setPreset(null);
                  setKind("amount");
                  setValue(event.target.valueAsNumber || 0);
                }}
                placeholder="Custom"
                className="mt-2 h-10 w-full border-b border-kds-border bg-transparent font-mono text-[15px] tracking-[0.02em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
              />
            </label>

            <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-accent-primary uppercase">
              Takes €{order.total.toFixed(2)} to{" "}
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={preview.total}
                  {...numberTransition}
                  className="inline-block tabular-nums"
                >
                  €{preview.total.toFixed(2)}
                </motion.span>
              </AnimatePresence>
            </p>

            <label className="block">
              <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
                Reason
              </span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Spilled it"
                className="mt-2 h-10 w-full border-b border-kds-border bg-transparent text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
              />
            </label>
          </div>

          <div className="border-t border-kds-border p-6">
            {!canApply && (
              <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase">
                A reason, so the ledger means something.
              </p>
            )}
            {error && (
              <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase">
                {error}
              </p>
            )}
            <motion.button
              type="button"
              onClick={apply}
              disabled={!canApply || pending}
              whileTap={{ scale: 0.98 }}
              transition={pressSpring}
              className="flex h-10 w-full items-center justify-center rounded-full bg-accent-primary font-mono text-[11px] font-medium tracking-[0.14em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:bg-kds-surface disabled:text-kds-text-secondary"
            >
              {pending ? "Applying" : "Apply"}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
