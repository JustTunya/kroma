"use client";

import Link from "next/link";

import type { BoardOrder } from "@/types/board";

/**
 * Orders for later. They promote themselves into the live lanes half an hour
 * before pickup, so this is a place to look ahead rather than a queue to work.
 *
 * A native <details>: the platform already has a disclosure widget with
 * keyboard handling and correct semantics, and it does not need to animate.
 */
export function ScheduledDrawer({ orders }: { orders: BoardOrder[] }) {
  if (orders.length === 0) return null;

  return (
    <details className="mt-4 border-y border-kds-border">
      <summary className="cursor-pointer list-none py-4 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase transition-colors hover:text-kds-text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kds-text-primary">
        Later today
        <span aria-hidden className="mx-3 text-kds-border">
          /
        </span>
        <span className="tabular-nums">{orders.length}</span>
      </summary>

      <ul className="divide-y divide-kds-border border-t border-kds-border">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              href={`/dashboard/order/${order.id}`}
              className="flex items-baseline justify-between gap-6 py-4 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kds-text-primary"
            >
              <span className="truncate">
                <span className="tabular-nums">{order.order_number}</span>
                <span aria-hidden className="mx-3 text-kds-border">
                  /
                </span>
                {order.bar_name ?? order.customer_name ?? "Guest"}
                <span aria-hidden className="mx-3 text-kds-border">
                  /
                </span>
                <span className="text-kds-text-secondary">
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                {new Date(order.pickup_at!).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
