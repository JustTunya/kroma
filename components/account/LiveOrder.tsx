"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { pickupCountdown } from "@/lib/active-order";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { useActiveOrder } from "@/lib/use-active-order";

// Fixed, so it appears without shifting the page (CLS) and stays under the thumb on mobile.
export function LiveOrder() {
  const order = useActiveOrder(true);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[22rem]"
    >
      {order && (
        <Link
          href={order.access_token ? `/order/${order.access_token}` : "/account/orders"}
          className="pointer-events-auto flex min-h-14 items-center gap-4 rounded-sm bg-text-primary px-5 py-3 text-surface-canvas shadow-[0_8px_30px_rgb(0_0_0/0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-accent-primary motion-safe:animate-pulse" />
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-[20px] leading-tight">
              {ORDER_STATUS_LABELS[order.status].text}
            </span>
            <span className="block font-mono text-[11px] font-medium tracking-[0.14em] text-kds-text-secondary uppercase">
              Order #{order.order_number}
              {pickupCountdown(order.status, order.pickup_at) && (
                <> / {pickupCountdown(order.status, order.pickup_at)}</>
              )}
            </span>
          </span>
          <ArrowUpRight aria-hidden className="size-5 shrink-0" />
        </Link>
      )}
    </div>
  );
}
