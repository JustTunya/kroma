"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup } from "framer-motion";

import { advanceOrderAction } from "@/app/dashboard/actions";
import { useBoardStatus } from "@/components/dashboard/BoardStatus";
import { LaneRail } from "@/components/dashboard/LaneRail";
import { OrderLane } from "@/components/dashboard/OrderLane";
import { ageSince } from "@/components/dashboard/OrderRow";
import { ScheduledDrawer } from "@/components/dashboard/ScheduledDrawer";
import { ShiftStart } from "@/components/dashboard/ShiftStart";
import { NEXT_STATUS } from "@/lib/order-transitions";
import { useBoard, useBoardPoll } from "@/lib/use-board";
import { useChime } from "@/lib/use-chime";

import type { BoardOrder } from "@/types/board";
import type { OrderStatus } from "@/lib/order-status";

/**
 * Four lanes, in the order the work happens. `pending` sits beside `paid`
 * rather than in a queue of its own: it is a real order that someone is
 * standing there waiting for, it just has not been paid for yet.
 */
const LANES: { title: string; statuses: OrderStatus[]; empty: string }[] = [
  {
    title: "On the pass",
    statuses: ["pending", "paid"],
    empty: "Nothing on the pass.",
  },
  { title: "Brewing", statuses: ["preparing"], empty: "Nothing brewing." },
  {
    title: "Ready at the bar",
    statuses: ["ready"],
    empty: "Nothing waiting to be collected.",
  },
  { title: "Collected", statuses: ["collected"], empty: "Nothing collected yet." },
];

/** An order this far out is not work yet — it waits in the drawer. */
const SCHEDULED_LEAD_MS = 30 * 60_000;

export function OrderBoard({
  initial,
  unlocked,
}: {
  initial: BoardOrder[];
  unlocked: boolean;
}) {
  const { orders, refetch } = useBoard(initial);
  const { connection, freshAt } = useBoardStatus();
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [lane, setLane] = useState(LANES[0].title);
  const [started, setStarted] = useState(false);
  const { arm, play } = useChime();

  useBoardPoll(connection, refetch);

  // Ping only when an order the board has never seen appears. Comparing ids
  // rather than counts means an advance or a collection stays silent, and a
  // reconnect re-fetch does not replay the morning.
  const known = useRef(new Set(initial.map((order) => order.id)));
  useEffect(() => {
    const fresh = orders.filter((order) => !known.current.has(order.id));
    known.current = new Set(orders.map((order) => order.id));
    if (fresh.length > 0) play();
  }, [orders, play]);

  // One clock for every timer and every spine, so nothing ticks out of step.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { live, scheduled } = useMemo(() => {
    const cutoff = now.getTime() + SCHEDULED_LEAD_MS;
    const scheduled: BoardOrder[] = [];
    const live: BoardOrder[] = [];

    for (const order of orders) {
      const pickup = order.pickup_at ? new Date(order.pickup_at).getTime() : null;
      // Only a not-yet-started order can wait: once someone has begun making
      // it, it belongs on the board whatever the pickup time says.
      if (pickup && pickup > cutoff && (order.status === "pending" || order.status === "paid")) {
        scheduled.push(order);
      } else {
        live.push(order);
      }
    }

    scheduled.sort(
      (a, b) => new Date(a.pickup_at!).getTime() - new Date(b.pickup_at!).getTime(),
    );
    // Longest wait first, per lane. In the ready lane that puts the order
    // nobody has come for at the top, which is the point.
    live.sort((a, b) => ageSince(a).getTime() - ageSince(b).getTime());

    return { live, scheduled };
  }, [orders, now]);

  async function advance(order: BoardOrder) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;

    setError(null);
    const result = await advanceOrderAction(order.id, next);
    if (!result.ok) setError(result.error ?? "That did not go through.");
    void refetch();
  }

  // Writes are refused while the socket is down. Queuing them for replay would
  // leave two iPads to reconcile divergent order state on reconnect, which is
  // far worse than ten minutes on paper.
  const disabled = connection === "offline" || !unlocked;

  const counts = LANES.map((entry) => ({
    title: entry.title,
    count: live.filter((order) => entry.statuses.includes(order.status)).length,
  }));

  return (
    <>
      {/* Not wrapped in AnimatePresence: the clock below re-renders this
          component every second, and an unkeyed presence child restarts its
          entrance on each tick — the overlay never finished fading in. There
          is nothing to animate on the way out anyway; the shift starts once. */}
      {!started && (
        <ShiftStart
          onStart={() => {
            arm();
            setStarted(true);
          }}
        />
      )}

      <div className="px-5 sm:px-10 lg:px-14 print:hidden">
        {disabled && (
          <p
            role="status"
            className="mt-4 border-y border-kds-border py-4 font-mono text-[11px] leading-[1.6] tracking-[0.14em] uppercase"
          >
            {connection === "offline" ? (
              <span className="text-badge-alert">
                Offline since{" "}
                {freshAt.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                . Print the pass list and work from paper.
              </span>
            ) : (
              <span className="text-accent-primary">
                Unlock with your PIN to move an order.
              </span>
            )}
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

        <ScheduledDrawer orders={scheduled} />

        <LaneRail lanes={counts} active={lane} onSelect={setLane} />
      </div>

      <LayoutGroup>
        <div className="mt-4 grid grid-cols-1 border-t border-kds-border lg:grid-cols-4">
          {LANES.map((entry) => (
            <OrderLane
              key={entry.title}
              title={entry.title}
              empty={entry.empty}
              orders={live.filter((order) => entry.statuses.includes(order.status))}
              now={now}
              onAdvance={advance}
              disabled={disabled}
              // Below lg only the chosen lane renders. Four columns need width
              // the phone in an apron pocket does not have, and one stacked
              // scroll buries "ready at the bar" under the whole pass.
              hiddenOnSmall={entry.title !== lane}
            />
          ))}
        </div>
      </LayoutGroup>

      <div className="px-5 py-10 sm:px-10 lg:px-14 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase transition-colors hover:text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
        >
          Print pass list
        </button>
      </div>
    </>
  );
}
