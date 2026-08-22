"use client";

import { AnimatePresence } from "framer-motion";

import { OrderRow } from "@/components/dashboard/OrderRow";

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
}: {
  title: string;
  orders: BoardOrder[];
  now: Date;
  onAdvance: (order: BoardOrder) => void;
  disabled: boolean;
  empty: string;
}) {
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col border-kds-border max-lg:border-t lg:border-l lg:first:border-l-0"
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-kds-border px-5 py-4">
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
