import type { OrderStatus } from "@/lib/order-status";
import type { StaffAction } from "@/lib/staff-permissions";

export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "paid",
  paid: "preparing",
  preparing: "ready",
  ready: "collected",
};

export const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  paid: "pending",
  preparing: "paid",
  ready: "preparing",
  collected: "ready",
};

const VOIDABLE: OrderStatus[] = ["pending", "paid", "preparing", "ready"];

export function canCancelSelf(status: OrderStatus): boolean {
  return status === "pending" || status === "paid";
}

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

export const UNDO_WINDOW_MS = 90_000;

export function canUndoFreely(stampedAt: Date | null, now: Date): boolean {
  if (!stampedAt) return false;
  return now.getTime() - stampedAt.getTime() <= UNDO_WINDOW_MS;
}

export const ADVANCE_LABELS: Partial<Record<OrderStatus, string>> = {
  pending: "Paid at counter",
  paid: "Start",
  preparing: "On the bar",
  ready: "Collected",
};

export const TENDERS = ["cash", "card"] as const;
export type Tender = (typeof TENDERS)[number];

export const TENDER_LABELS: Record<Tender, string> = { cash: "Cash", card: "Card" };
