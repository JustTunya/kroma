import type { OrderStatus } from "@/lib/order-status";
import type { StaffAction } from "@/lib/staff-permissions";

/**
 * The pass, as a graph.
 *
 * Mirrors order_transition_action() in 20260822090200_order_board.sql.
 * advance_order() is the authority; this is what lets the board grey out a
 * button before the round trip and pick the right label for it.
 */

/** Forward, one lane at a time. */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "paid",
  paid: "preparing",
  preparing: "ready",
  ready: "collected",
};

/** Backwards, one lane at a time. */
export const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  paid: "pending",
  preparing: "paid",
  ready: "preparing",
  collected: "ready",
};

/** Everything still on the pass. A collected order is refunded, never voided. */
const VOIDABLE: OrderStatus[] = ["pending", "paid", "preparing", "ready"];

/**
 * The customer's own escape hatch, and the whole of it: while the order is
 * still waiting it costs the shop nothing to drop, and the moment someone
 * presses Start it is being made. No timer to tune — the board decides.
 */
export function canCancelSelf(status: OrderStatus): boolean {
  return status === "pending" || status === "paid";
}

/**
 * "order.undo" is not a permission. advance_order() resolves it to
 * order.advance inside the 90-second window and order.undo_late outside it,
 * because only the database knows when the stamp was written.
 */
export function transitionAction(
  from: OrderStatus,
  to: OrderStatus,
): StaffAction | "order.undo" | null {
  if (to === "cancelled") return VOIDABLE.includes(from) ? "order.void" : null;
  if (to === "refunded") return from === "collected" ? "order.refund" : null;
  if (to === "abandoned") return from === "ready" ? "order.abandon" : null;
  if (NEXT_STATUS[from] === to) return "order.advance";
  if (PREV_STATUS[from] === to) return "order.undo";
  return null;
}

/**
 * Stepping back is free for a minute and a half, then it is a manager's call.
 * "Ready" gets pressed early all day; a hard one-way machine just gets worked
 * around with voids and re-rings, which is worse for the data than a logged undo.
 */
export const UNDO_WINDOW_MS = 90_000;

export function canUndoFreely(stampedAt: Date | null, now: Date): boolean {
  if (!stampedAt) return false;
  return now.getTime() - stampedAt.getTime() <= UNDO_WINDOW_MS;
}

/** What the forward button says. Operational verbs, never e-commerce ones. */
export const ADVANCE_LABELS: Partial<Record<OrderStatus, string>> = {
  pending: "Paid at counter",
  paid: "Start",
  preparing: "On the bar",
  ready: "Collected",
};

/** The two ways money arrives at the counter. Online settles itself. */
export const TENDERS = ["cash", "card"] as const;
export type Tender = (typeof TENDERS)[number];

export const TENDER_LABELS: Record<Tender, string> = { cash: "Cash", card: "Card" };
