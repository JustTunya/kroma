/**
 * One source of truth for how an order's state is worded. Both the guest
 * confirmation page and the account order list read it, so the bar and the
 * customer never see two different words for the same thing.
 */
export const ORDER_STATUSES = [
  "pending",
  "paid",
  "preparing",
  "ready",
  "collected",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, { text: string; tone: string }> = {
  pending: { text: "On the pass", tone: "text-accent-primary" },
  paid: { text: "Paid — on the pass", tone: "text-badge-live" },
  preparing: { text: "Brewing now", tone: "text-badge-live" },
  ready: { text: "Ready at the bar", tone: "text-badge-live" },
  collected: { text: "Collected", tone: "text-text-tertiary" },
  cancelled: { text: "Cancelled", tone: "text-badge-alert" },
};

/** Settled orders stop polling — nothing more will happen to them. */
export function isSettled(status: OrderStatus): boolean {
  return status === "collected" || status === "cancelled";
}
