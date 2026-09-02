"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { LayoutGroup } from "framer-motion";

import { advanceOrderAction, startShiftAction } from "@/app/dashboard/actions";
import { useBoardStatus } from "@/components/dashboard/BoardStatus";
import { LaneRail } from "@/components/dashboard/LaneRail";
import { OrderLane } from "@/components/dashboard/OrderLane";
import { ageSince } from "@/components/dashboard/OrderRow";
import { ScheduledDrawer } from "@/components/dashboard/ScheduledDrawer";
import { ServiceClosed } from "@/components/dashboard/ServiceClosed";
import { ShiftStart } from "@/components/dashboard/ShiftStart";
import { NEXT_STATUS } from "@/lib/order-transitions";
import { useBoard, useBoardPoll } from "@/lib/use-board";
import { useChime } from "@/lib/use-chime";

import type { BoardOrder } from "@/types/board";
import type { OrderStatus } from "@/lib/order-status";
import type { ParItem } from "@/lib/service-day";

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

const SCHEDULED_LEAD_MS = 30 * 60_000;

export function OrderBoard({
  initial,
  unlocked,
  shiftSince,
  dayOpen,
  par,
}: {
  initial: BoardOrder[];
  unlocked: boolean;

  shiftSince: string | null;

  dayOpen: boolean;

  par: ParItem[];
}) {
  const { orders, refetch } = useBoard(initial);
  const { connection, freshAt } = useBoardStatus();
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [lane, setLane] = useState(LANES[0].title);

  const [starting, startShift] = useTransition();
  const { arm, play } = useChime();

  const onShift = Boolean(shiftSince) || starting;
  const askToStart = unlocked && !onShift;

  useBoardPoll(connection, refetch);

  useEffect(() => {
    if (askToStart) return;
    const gesture = () => arm();
    window.addEventListener("pointerdown", gesture, { once: true });
    return () => window.removeEventListener("pointerdown", gesture);
  }, [askToStart, arm]);

  const known = useRef(new Set(initial.map((order) => order.id)));
  useEffect(() => {
    const fresh = orders.filter((order) => !known.current.has(order.id));
    known.current = new Set(orders.map((order) => order.id));
    if (fresh.length > 0) play();
  }, [orders, play]);

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

      if (pickup && pickup > cutoff && (order.status === "pending" || order.status === "paid")) {
        scheduled.push(order);
      } else {
        live.push(order);
      }
    }

    scheduled.sort(
      (a, b) => new Date(a.pickup_at!).getTime() - new Date(b.pickup_at!).getTime(),
    );

    live.sort((a, b) => ageSince(a).getTime() - ageSince(b).getTime());

    return { live, scheduled };
  }, [orders, now]);

  async function advance(order: BoardOrder, tender?: "cash" | "card") {
    const to = order.status === "pending" && order.payment_method === "counter" && tender
      ? "paid"
      : NEXT_STATUS[order.status];
    if (!to) return;

    setError(null);
    const result = await advanceOrderAction(order.id, to, tender);
    if (!result.ok) setError(result.error ?? "That did not go through.");
    void refetch();
  }

  const disabled = connection === "offline" || !unlocked;

  const counts = LANES.map((entry) => ({
    title: entry.title,
    count: live.filter((order) => entry.statuses.includes(order.status)).length,
  }));

  if (!dayOpen) return <ServiceClosed items={par} unlocked={unlocked} />;

  return (
    <>
      {}
      {askToStart && (
        <ShiftStart
          error={error}
          onStart={() => {
            arm();
            setError(null);
            startShift(async () => {
              const result = await startShiftAction();
              if (!result.ok) {
                setError(result.error ?? "That did not go through.");
              }
            });
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
              <Link
                href="/dashboard/unlock"
                className="text-accent-primary underline decoration-accent-primary/40 underline-offset-4 transition-colors hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
              >
                Unlock with your PIN to move an order.
              </Link>
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

              hiddenOnSmall={entry.title !== lane}
            />
          ))}
        </div>
      </LayoutGroup>

      <div className="flex items-center gap-5 px-5 py-10 sm:px-10 lg:px-14 print:hidden">
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
