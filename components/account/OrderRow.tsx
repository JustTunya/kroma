"use client";

import { motion } from "framer-motion";

import { ReorderButton } from "@/components/account/ReorderButton";
import { spring } from "@/lib/motion";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import type { CartLine } from "@/lib/cart";

/**
 * One past order, given the menu row's treatment: the number at display size,
 * everything else on a mono meta line that slides under the cursor with the
 * reorder affordance riding at its end.
 *
 * ponytail: the row is not a link — /account/orders/[id] is Task 8 of
 * docs/superpowers/plans/2026-08-19-account-dashboard.md and would 404 today.
 * Wrap the number in a Link to that route when it lands.
 */
export function OrderRow({
  orderNumber,
  date,
  summary,
  status,
  total,
  lines,
  unavailable,
}: {
  orderNumber: number;
  date: string;
  summary: string;
  status: OrderStatus;
  total: number;
  lines: CartLine[];
  unavailable: string[];
}) {
  const label = ORDER_STATUS_LABELS[status];

  return (
    <motion.li whileHover="hover" className="group py-7 sm:py-9">
      <div className="flex items-baseline justify-between gap-5">
        <motion.span
          variants={{ hover: { x: 10 } }}
          transition={spring}
          className="font-serif text-[clamp(24px,2.6vw,34px)] leading-[1.05] tracking-[-0.02em] text-text-primary tabular-nums"
        >
          #{String(orderNumber).padStart(3, "0")}
        </motion.span>

        <span className="shrink-0 font-mono text-[15px] font-medium tracking-[0.02em] text-text-primary tabular-nums">
          €{total.toFixed(2)}
        </span>
      </div>

      <motion.div
        variants={{ hover: { x: 10 } }}
        transition={spring}
        className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase"
      >
        {date}
        <span aria-hidden className="text-hairline">
          /
        </span>
        {summary}
        <span aria-hidden className="text-hairline">
          /
        </span>
        <span className={label.tone}>{label.text}</span>

        {unavailable.length > 0 && (
          <span className="flex items-center gap-3">
            <span aria-hidden className="text-hairline">
              /
            </span>
            <span className="text-badge-alert">
              {unavailable.length === 1
                ? "One line is gone for today"
                : `${unavailable.length} lines are gone for today`}
            </span>
          </span>
        )}

        {lines.length > 0 && (
          /* Plain CSS for the reveal: paint, not structure. Always shown where
             there is no cursor to hover with. */
          <span className="flex items-center gap-3 opacity-100 transition-opacity duration-300 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
            <span aria-hidden className="text-hairline">
              /
            </span>
            <ReorderButton lines={lines} label="Order again" variant="inline" />
          </span>
        )}
      </motion.div>
    </motion.li>
  );
}
