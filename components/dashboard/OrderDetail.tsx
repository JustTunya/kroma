"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";

import { advanceOrderAction, noteOrderAction } from "@/app/dashboard/actions";
import { DiscountSheet } from "@/components/dashboard/DiscountSheet";
import { pressSpring } from "@/lib/motion";
import { isStale } from "@/lib/order-age";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { ADVANCE_LABELS, NEXT_STATUS, PREV_STATUS, TENDERS, TENDER_LABELS, type Tender } from "@/lib/order-transitions";
import { staffCan } from "@/lib/staff-permissions";

import type { OrderStatus } from "@/lib/order-status";
import type { StaffRole } from "@/lib/staff-permissions";
import type { BoardOrder } from "@/types/board";

type StaffEvent = {
  action: string;
  created_at: string;
  staff: { display_name: string } | null;
};

/** The audit trail reads as sentences, not as event names. */
const EVENT_WORDS: Record<string, string> = {
  "order.advance": "moved it on",
  "order.undo_late": "stepped it back",
  "order.void": "voided it",
  "order.abandon": "marked it not collected",
  "order.cancel_self": "cancelled it from their phone",
  "order.refund": "refunded it",
  "order.note": "left a note",
  "item.86": "86'd an item",
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function OrderDetail({
  order,
  role,
  events,
}: {
  order: BoardOrder;
  role: StaffRole | null;
  events: StaffEvent[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canVoid = role ? staffCan(role, "order.void") : false;
  const canRefund = role ? staffCan(role, "order.refund") : false;
  const canDiscount = role ? staffCan(role, "order.discount") : false;
  const [discounting, setDiscounting] = useState(false);
  // Half an hour on the bar is when the board stops calling it late and starts
  // calling it nobody's. Before that the button is still there but the RPC
  // charges it to order.void, so a barista gets "Not yours to do."
  const canAbandon =
    order.status === "ready" &&
    (canVoid || isStale(new Date(order.ready_at ?? order.placed_at), new Date()));
  const next = NEXT_STATUS[order.status];
  const previous = PREV_STATUS[order.status];

  function move(to: OrderStatus, tender?: Tender) {
    setError(null);
    startTransition(async () => {
      const result = await advanceOrderAction(order.id, to, tender);
      // Always refresh: a failed refund still moved the order, and the page
      // must not go on showing the old lane while the error says otherwise.
      router.refresh();
      if (!result.ok) setError(result.error ?? "That did not go through.");
    });
  }

  function addNote() {
    setError(null);
    startTransition(async () => {
      const result = await noteOrderAction(order.id, note);
      if (result.ok) {
        setNote("");
        router.refresh();
      } else {
        setError(result.error ?? "That did not go through.");
      }
    });
  }

  const stamps: [string, string | null][] = [
    ["Placed", order.placed_at],
    ["Started", order.started_at],
    ["Ready", order.ready_at],
    ["Collected", order.collected_at],
  ];

  return (
    <article className="px-5 pb-20 sm:px-10 lg:px-14">
      <Link
        href="/dashboard/board"
        className="inline-block pt-10 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase transition-colors hover:text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
      >
        <span aria-hidden>← </span>The pass
      </Link>

      <p className="mt-8 font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
        {ORDER_STATUS_LABELS[order.status].text}
      </p>

      <div className="mt-4 flex items-baseline justify-between gap-6">
        <h1 className="min-w-0 truncate font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em]">
          {order.bar_name ?? order.customer_name ?? "Guest"}
        </h1>
        <span className="shrink-0 font-mono text-[28px] font-medium tabular-nums">
          {order.day_number ?? order.order_number}
        </span>
      </div>

      <p className="mt-5 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
        {order.settled_as
          ? { cash: "Cash", card: "Card at the bar", online: "Paid online" }[order.settled_as]
          : "Not paid yet"}
        <Divider />
        <span className="tabular-nums text-kds-text-primary">
          €{order.total.toFixed(2)}
        </span>
        <Divider />
        {order.is_regular} collected before
        {order.pickup_at && (
          <>
            <Divider />
            For {clock(order.pickup_at)}
          </>
        )}
      </p>

      {order.avoid_allergens.length > 0 && (
        <p className="mt-4 font-mono text-[10px] font-medium tracking-[0.18em] text-badge-alert uppercase">
          {order.avoid_allergens.map((allergen, i) => (
            <span key={allergen}>
              {i > 0 && <Divider />}
              No {allergen}
            </span>
          ))}
        </p>
      )}

      <ul className="mt-10 divide-y divide-kds-border border-y border-kds-border">
        {order.items.map((item, i) => (
          <li key={i} className="flex items-baseline justify-between gap-6 py-5">
            <div className="min-w-0">
              <p className="font-serif text-[22px] leading-[1.05] tracking-[-0.02em]">
                <span className="tabular-nums">{item.quantity}×</span>{" "}
                {item.item_name}
              </p>

              {item.selected_modifiers.length > 0 && (
                <p className="mt-2.5 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
                  {item.selected_modifiers.map((modifier, j) => (
                    <span key={modifier.option}>
                      {j > 0 && <Divider />}
                      {modifier.option}
                    </span>
                  ))}
                </p>
              )}

              {item.gone && (
                <p className="mt-2.5 font-mono text-[10px] font-medium tracking-[0.18em] text-badge-alert uppercase">
                  Gone for today
                </p>
              )}
            </div>

            <span className="shrink-0 font-mono text-[15px] tabular-nums">
              €{item.line_total.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mt-8 max-w-lg text-[15px] leading-[1.6] whitespace-pre-line text-kds-text-secondary">
          {order.notes}
        </p>
      )}

      <div className="mt-8 flex max-w-lg gap-3">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addNote();
          }}
          maxLength={280}
          placeholder="Oat instead of whole"
          aria-label="Add a note to this order"
          className="h-10 min-w-0 flex-1 border-b border-kds-border bg-transparent text-[15px] placeholder:text-kds-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
        />
        <motion.button
          type="button"
          onClick={addNote}
          disabled={pending || !note.trim()}
          whileTap={{ scale: 0.98 }}
          transition={pressSpring}
          className="h-10 shrink-0 rounded-full border border-kds-border px-5 font-mono text-[10px] font-medium tracking-[0.18em] uppercase transition-colors hover:border-kds-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:text-kds-text-secondary"
        >
          Add note
        </motion.button>
      </div>

      {/* Actions, quietest to loudest: move it on, step it back, settle it. */}
      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-kds-border pt-8">
        {order.status === "pending" && order.payment_method === "counter" ? (
          // Two taps become one, and the drawer becomes countable. The same
          // press that says "paid" says how.
          TENDERS.map((tender) => (
            <motion.button
              key={tender}
              type="button"
              onClick={() => move("paid", tender)}
              disabled={pending || !role}
              whileTap={{ scale: 0.98 }}
              transition={pressSpring}
              className="h-10 rounded-full bg-accent-primary px-5 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:bg-kds-surface disabled:text-kds-text-secondary"
            >
              {TENDER_LABELS[tender]}
            </motion.button>
          ))
        ) : next ? (
          <motion.button
            type="button"
            onClick={() => move(next)}
            disabled={pending || !role}
            whileTap={{ scale: 0.98 }}
            transition={pressSpring}
            className="h-10 rounded-full bg-accent-primary px-5 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:bg-kds-surface disabled:text-kds-text-secondary"
          >
            {ADVANCE_LABELS[order.status]}
          </motion.button>
        ) : null}

        {previous && (
          <motion.button
            type="button"
            onClick={() => move(previous)}
            disabled={pending || !role}
            whileTap={{ scale: 0.98 }}
            transition={pressSpring}
            className="h-10 rounded-full border border-kds-border px-5 font-mono text-[10px] font-medium tracking-[0.18em] uppercase transition-colors hover:border-kds-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:text-kds-text-secondary"
          >
            Step back
          </motion.button>
        )}

        {canVoid && order.status !== "collected" && (
          <SettleButton
            label={
              order.payment_method === "online"
                ? "Void — stock and money return"
                : "Void — stock returns"
            }
            onClick={() => move("cancelled")}
            disabled={pending || !role}
          />
        )}

        {canAbandon && (
          <SettleButton
            label="Not collected — nothing comes back"
            onClick={() => move("abandoned")}
            disabled={pending || !role}
          />
        )}

        {canRefund && order.status === "collected" && (
          <SettleButton
            label={
              order.payment_method === "online"
                ? "Refund — stock stays gone"
                : "Refund — from the till"
            }
            onClick={() => move("refunded")}
            disabled={pending || !role}
          />
        )}

        {canDiscount && order.status !== "cancelled" && order.status !== "refunded" && (
          <SettleButton
            label="Discount"
            onClick={() => setDiscounting(true)}
            disabled={pending || !role}
          />
        )}
      </div>

      {order.discount_total > 0 && (
        <p className="mt-4 font-mono text-[11px] font-medium tracking-[0.14em] text-accent-primary uppercase">
          {order.total === 0 ? "Comped" : `−€${order.discount_total.toFixed(2)}`}
          <Divider />
          {order.discount_reason}
        </p>
      )}

      <DiscountSheet order={discounting ? order : null} onClose={() => setDiscounting(false)} />

      {!role && (
        <p
          role="status"
          className="mt-4 font-mono text-[11px] tracking-[0.14em] text-accent-primary uppercase"
        >
          Unlock with your PIN to change anything.
        </p>
      )}

      {error && (
        <p
          role="status"
          className="mt-4 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase"
        >
          {error}
        </p>
      )}

      <section aria-label="Timings" className="mt-14">
        <h2 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
          Timings
        </h2>
        <p className="mt-5 font-mono text-[11px] tracking-[0.14em] uppercase">
          {stamps.map(([label, stamp], i) => (
            <span key={label} className={stamp ? undefined : "text-kds-text-secondary"}>
              {i > 0 && <Divider />}
              {label} {stamp ? clock(stamp) : "—"}
            </span>
          ))}
        </p>
      </section>

      {events.length > 0 && (
        <section aria-label="What happened" className="mt-14">
          <h2 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
            What happened
          </h2>
          <ul className="mt-6 divide-y divide-kds-border border-y border-kds-border">
            {events.map((event, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-6 py-4 font-mono text-[11px] tracking-[0.14em] uppercase"
              >
                <span className="min-w-0 truncate">
                  {event.staff?.display_name ?? "System"}
                  <Divider />
                  <span className="text-kds-text-secondary">
                    {EVENT_WORDS[event.action] ?? event.action}
                  </span>
                </span>
                <span className="shrink-0 text-kds-text-secondary tabular-nums">
                  {clock(event.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function SettleButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.98 }}
      transition={pressSpring}
      className="h-10 rounded-full border border-badge-alert px-5 font-mono text-[10px] font-medium tracking-[0.18em] text-badge-alert uppercase transition-colors hover:bg-badge-alert hover:text-surface-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:opacity-50"
    >
      {label}
    </motion.button>
  );
}

/** The `/` glyph between metadata, per the brand's hairline vocabulary. */
function Divider() {
  return (
    <span aria-hidden className="mx-3 text-kds-border">
      /
    </span>
  );
}
