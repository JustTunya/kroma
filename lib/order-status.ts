
export const ORDER_STATUSES = [
  "pending",
  "paid",
  "preparing",
  "ready",
  "collected",
  "cancelled",
  "refunded",
  "abandoned",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, { text: string; tone: string }> = {
  pending: { text: "On the pass", tone: "text-accent-primary" },
  paid: { text: "Paid — on the pass", tone: "text-badge-live" },
  preparing: { text: "Brewing now", tone: "text-badge-live" },
  ready: { text: "Ready at the bar", tone: "text-badge-live" },
  collected: { text: "Collected", tone: "text-text-tertiary" },
  cancelled: { text: "Cancelled", tone: "text-badge-alert" },
  refunded: { text: "Refunded", tone: "text-badge-alert" },

  abandoned: { text: "Not collected", tone: "text-badge-alert" },
};

export function isSettled(status: OrderStatus): boolean {
  return (
    status === "collected" ||
    status === "cancelled" ||
    status === "refunded" ||
    status === "abandoned"
  );
}
