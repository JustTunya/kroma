"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { openServiceAction } from "@/app/dashboard/actions";
import { numberTransition, pressSpring } from "@/lib/motion";
import { dayLabel, parOverrides, type ParItem } from "@/lib/service-day";
import { shopDayKey } from "@/lib/manage";

export function ServiceClosed({
  items,
  unlocked,
}: {
  items: ParItem[];
  unlocked: boolean;
}) {
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.par_stock])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set(id: string, value: number) {
    setCounts((current) => ({ ...current, [id]: Math.max(0, Math.min(999, value)) }));
  }

  function open() {
    setError(null);
    start(async () => {
      const result = await openServiceAction(parOverrides(items, counts));
      if (!result.ok) setError(result.error ?? "That did not go through.");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-kds-canvas">
      <header className="flex items-baseline justify-between gap-4 border-b border-kds-border px-5 py-5 sm:px-10 lg:px-14">
        <h1 className="font-mono text-[11px] font-medium tracking-[0.18em] uppercase">
          Restock
        </h1>
        <span className="font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
          {dayLabel(shopDayKey())}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 sm:px-10 lg:px-14">
        {items.length === 0 ? (
          <p className="py-10 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
            No batch items to prep today.
          </p>
        ) : (
          <ul className="divide-y divide-kds-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-6 py-4">
                <span className="min-w-0 truncate font-mono text-[13px] font-medium tracking-[0.02em]">
                  {item.name}
                  <span className="mt-0.5 block font-mono text-[10px] tracking-[0.14em] text-kds-text-secondary uppercase">
                    Par {item.par_stock}
                  </span>
                </span>

                <div className="flex shrink-0 items-center gap-3">
                  <motion.button
                    type="button"
                    onClick={() => set(item.id, (counts[item.id] ?? 0) - 1)}
                    disabled={(counts[item.id] ?? 0) <= 0}
                    whileTap={{ scale: 0.98 }}
                    transition={pressSpring}
                    aria-label={`One fewer ${item.name}`}
                    className="flex size-9 items-center justify-center rounded-full border border-kds-border text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:text-kds-text-secondary disabled:opacity-50"
                  >
                    <Minus aria-hidden size={14} strokeWidth={2} />
                  </motion.button>

                  <div className="w-8 overflow-hidden text-center">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={counts[item.id] ?? 0}
                        {...numberTransition}
                        className="block font-mono text-[16px] font-medium tabular-nums"
                      >
                        {counts[item.id] ?? 0}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  <motion.button
                    type="button"
                    onClick={() => set(item.id, (counts[item.id] ?? 0) + 1)}
                    whileTap={{ scale: 0.98 }}
                    transition={pressSpring}
                    aria-label={`One more ${item.name}`}
                    className="flex size-9 items-center justify-center rounded-full border border-kds-border text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
                  >
                    <Plus aria-hidden size={14} strokeWidth={2} />
                  </motion.button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-kds-border px-5 py-4 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={open}
            disabled={!unlocked || pending}
            className="flex h-10 shrink-0 items-center rounded-full bg-accent-primary px-6 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:bg-kds-surface disabled:text-kds-text-secondary"
          >
            {pending ? "Opening" : "Open service"}
          </button>

          {!unlocked ? (
            <Link
              href="/dashboard/unlock"
              role="status"
              className="font-mono text-[11px] tracking-[0.14em] text-accent-primary underline decoration-accent-primary/40 underline-offset-4 uppercase transition-colors hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              Unlock with your PIN to open the day
            </Link>
          ) : (
            error && (
              <p
                role="status"
                className="font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase"
              >
                {error}
              </p>
            )
          )}
        </div>
      </footer>
    </div>
  );
}
