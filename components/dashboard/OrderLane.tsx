"use client";

import { AnimatePresence } from "framer-motion";

import { OrderRow } from "@/components/dashboard/OrderRow";
import { cn } from "@/lib/utils";

import type { BoardOrder } from "@/types/board";

/**
 * One column of the pass.
 *
 * Columns are split by a left hairline rather than a gap, and rows are divided
 * by hairlines rather than being cards — the same two rules the storefront's
 * menu list follows. No radius, no shadow, no card chrome anywhere.
 */
export function OrderLane({
  title,
  orders,
  now,
  onAdvance,
  disabled,
  empty,
  hiddenOnSmall,
}: {
  title: string;
  orders: BoardOrder[];
  now: Date;
  onAdvance: (order: BoardOrder) => void;
  disabled: boolean;
  empty: string;
  /** Below lg the rail picks one lane; the rest stay mounted but hidden. */
  hiddenOnSmall: boolean;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "min-w-0 flex-col border-kds-border lg:flex lg:border-l lg:first:border-l-0",
        hiddenOnSmall ? "hidden" : "flex",
      )}
    >
      {/* The rail already names the lane below lg, and repeating it there
          costs a row of orders on the screen that has fewest. */}
      <header className="hidden items-baseline justify-between gap-3 border-b border-kds-border px-5 py-4 lg:flex">
        <h2 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
          {title}
        </h2>
        <span className="font-mono text-[12px] tabular-nums text-kds-text-secondary">
          {orders.length}
        </span>
      </header>

      {orders.length === 0 ? (
        <p className="px-5 py-10 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-kds-border px-5">
          <AnimatePresence initial={false}>
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                now={now}
                onAdvance={onAdvance}
                disabled={disabled}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
