"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { AgeSpine } from "@/components/dashboard/AgeSpine";
import { pressSpring, spring } from "@/lib/motion";
import { AGE_TONES, ageTier, elapsedLabel, isStale } from "@/lib/order-age";
import { ADVANCE_LABELS, NEXT_STATUS, TENDERS, TENDER_LABELS } from "@/lib/order-transitions";
import { cn } from "@/lib/utils";

import type { BoardOrder } from "@/types/board";

/**
 * Which stamp the row counts from: the age of the CURRENT state, not of the
 * order. A drink that has sat ready for eight minutes is the problem, however
 * long ago it was ordered.
 */
export function ageSince(order: BoardOrder): Date {
  const stamp =
    order.status === "ready"
      ? order.ready_at
      : order.status === "preparing"
        ? order.started_at
        : order.status === "collected"
          ? order.collected_at
          : order.placed_at;
  return new Date(stamp ?? order.placed_at);
}

export function OrderRow({
  order,
  now,
  onAdvance,
  disabled,
}: {
  order: BoardOrder;
  now: Date;
  onAdvance: (order: BoardOrder, tender?: "cash" | "card") => void;
  /** Offline, or nobody has unlocked the terminal. */
  disabled: boolean;
}) {
  const reduced = useReducedMotion();
  const from = ageSince(order);
  const tone = AGE_TONES[ageTier(from, now)];
  const next = NEXT_STATUS[order.status];
  const gone = order.items.some((item) => item.gone);
  const name = order.bar_name ?? order.customer_name ?? "Guest";

  // Everything that needs saying before the drink is handed over, in the order
  // it matters: money first, then what is missing, then what would hurt someone.
  const flags: { text: string; tone: string }[] = [
    ...(order.status === "pending"
      ? [{ text: "Take payment", tone: "text-accent-primary" }]
      : []),
    ...(gone ? [{ text: "Contains 86'd item", tone: "text-badge-alert" }] : []),
    ...(order.status === "ready" && isStale(from, now)
      ? [{ text: "Nobody has come for it", tone: "text-badge-alert" }]
      : []),
    ...order.avoid_allergens.map((allergen) => ({
      text: `No ${allergen}`,
      tone: "text-badge-alert",
    })),
    ...(order.claimed_by && order.status === "preparing"
      ? [{ text: order.claimed_by, tone: "text-kds-text-secondary" }]
      : []),
  ];

  return (
    <motion.li
      layout={reduced ? false : "position"}
      // Shared across lanes: the row travels when it is advanced rather than
      // vanishing here and appearing there. Reduced motion keeps the reflow —
      // the board must still be usable — and drops the travel.
      layoutId={reduced ? undefined : `order-${order.id}`}
      transition={{ layout: spring }}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: "easeOut" } }}
      className="flex gap-4"
    >
      <AgeSpine since={from} now={now} />

      <div className="min-w-0 flex-1 py-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-mono text-[28px] leading-none font-medium tabular-nums">
            {order.day_number ?? order.order_number}
          </span>
          <span
            className={cn(
              "font-mono text-[15px] tabular-nums transition-colors duration-300",
              tone.text,
            )}
          >
            {elapsedLabel(from, now)}
          </span>
        </div>

        <p className="mt-2.5 truncate font-serif text-[22px] leading-[1.05] tracking-[-0.02em]">
          {name}
        </p>

        <ul className="mt-4 space-y-1.5">
          {order.items.map((item, i) => (
            <li
              key={i}
              className="font-mono text-[11px] tracking-[0.14em] uppercase"
            >
              <span className="tabular-nums">{item.quantity}×</span>{" "}
              <span className={item.gone ? "text-badge-alert" : undefined}>
                {item.item_name}
              </span>
              {item.selected_modifiers.map((modifier) => (
                <span key={modifier.option} className="text-kds-text-secondary">
                  <span aria-hidden className="mx-2 text-kds-border">
                    /
                  </span>
                  {modifier.option}
                </span>
              ))}
            </li>
          ))}
        </ul>

        {flags.length > 0 && (
          <p className="mt-4 font-mono text-[10px] font-medium tracking-[0.18em] uppercase">
            {flags.map((flag, i) => (
              <span key={flag.text} className={flag.tone}>
                {i > 0 && (
                  <span aria-hidden className="mx-2 text-kds-border">
                    /
                  </span>
                )}
                {flag.text}
              </span>
            ))}
          </p>
        )}

        <div className="mt-5 flex items-center gap-5">
          {order.status === "pending" && order.payment_method === "counter" ? (
            TENDERS.map((tender) => (
              <motion.button
                key={tender}
                type="button"
                disabled={disabled}
                onClick={() => onAdvance(order, tender)}
                whileTap={disabled ? undefined : { scale: 0.98 }}
                transition={pressSpring}
                aria-label={`${TENDER_LABELS[tender]} — order ${order.day_number ?? order.order_number}, ${name}`}
                className="h-9 shrink-0 rounded-full bg-accent-primary px-5 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:bg-kds-surface disabled:text-kds-text-secondary"
              >
                {TENDER_LABELS[tender]}
              </motion.button>
            ))
          ) : next ? (
            <motion.button
              type="button"
              disabled={disabled}
              onClick={() => onAdvance(order)}
              whileTap={disabled ? undefined : { scale: 0.98 }}
              transition={pressSpring}
              aria-label={`${ADVANCE_LABELS[order.status]} — order ${order.day_number ?? order.order_number}, ${name}`}
              className="h-10 shrink-0 rounded-full bg-accent-primary px-5 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:bg-kds-surface disabled:text-kds-text-secondary"
            >
              {ADVANCE_LABELS[order.status]}
            </motion.button>
          ) : null}

          <Link
            href={`/dashboard/order/${order.id}`}
            className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase transition-colors hover:text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
          >
            Open
          </Link>
        </div>
      </div>
    </motion.li>
  );
}
