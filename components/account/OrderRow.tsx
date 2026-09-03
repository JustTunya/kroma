"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { ReorderButton } from "@/components/account/ReorderButton";
import { spring } from "@/lib/motion";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import type { CartLine } from "@/lib/cart";

export function OrderRow({
  token,
  orderNumber,
  date,
  summary,
  status,
  total,
  lines,
  unavailable,
}: {
  token: string;
  orderNumber: number;
  date: string;
  summary: string;
  status: OrderStatus;
  total: number;
  lines: CartLine[];
  unavailable: string[];
}) {
  const label = ORDER_STATUS_LABELS[status];
  const router = useRouter();

  return (
    <motion.li
      whileHover="hover"
      onClick={() => router.push(`/order/${token}`)}
      className="group cursor-pointer py-7 sm:py-9 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus"
      tabIndex={0}
      role="link"
      aria-label={`Order #${String(orderNumber).padStart(3, "0")}, ${date}, €${total.toFixed(2)}`}
      onKeyDown={(event) => {
        if (event.key === "Enter") router.push(`/order/${token}`);
      }}
    >
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

        <span className="flex items-center gap-3 opacity-100 transition-opacity duration-300 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
          <span aria-hidden className="text-hairline">
            /
          </span>
          <Link
            href={`/order/${token}/receipt`}
            onClick={(event) => event.stopPropagation()}
            className="hover:text-text-primary"
          >
            Receipt
          </Link>
        </span>

        {lines.length > 0 && (

          <span
            onClick={(event) => event.stopPropagation()}
            className="flex items-center gap-3 opacity-100 transition-opacity duration-300 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
          >
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
