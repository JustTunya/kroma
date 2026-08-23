"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useReportBoardStatus } from "@/components/dashboard/BoardStatus";
import { createClient } from "@/lib/client";

import type { BoardOrder } from "@/types/board";

/** Fallback cadence while the socket is down. A fallback, not a design. */
const POLL_MS = 30_000;

/**
 * The board's data.
 *
 * Subscribes to `orders` ONLY. order_items rows arrive in a separate
 * replication message from their parent insert, so listening to both renders a
 * card with no lines for a few hundred milliseconds on every new order.
 * Instead any event triggers one staff_board() re-fetch — a round trip that is
 * always internally consistent.
 *
 * On reconnect it re-fetches everything rather than replaying deltas: an event
 * missed while the socket was down is otherwise invisible forever.
 */
export function useBoard(initial: BoardOrder[]) {
  const [orders, setOrders] = useState(initial);
  const report = useReportBoardStatus();
  // One client for the life of the board. A new one per render would open a
  // new socket every tick of the clock.
  const supabase = useRef(createClient());

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.current.rpc("staff_board");
    if (error) {
      report({ connection: "offline" });
      return;
    }
    setOrders((data as BoardOrder[] | null) ?? []);
    report({ freshAt: new Date() });
  }, [report]);

  useEffect(() => {
    const client = supabase.current;
    const channel = client
      .channel("board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => void refetch(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          report({ connection: "live" });
          void refetch();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          report({ connection: "offline" });
        } else if (status === "CLOSED") {
          report({ connection: "reconnecting" });
        }
      });

    return () => {
      void client.removeChannel(channel);
      // Leaving the board means there is no connection to report. Without this
      // the pill keeps saying RECONNECTING on the order detail page, where
      // nothing is listening — a status bar that lies is worse than none.
      report({ connection: null });
    };
  }, [refetch, report]);

  return { orders, refetch };
}

/** Poll while disconnected, so a dropped socket degrades instead of freezing. */
export function useBoardPoll(
  connection: string | null,
  refetch: () => Promise<void>,
) {
  useEffect(() => {
    if (connection === "live" || connection === null) return;
    const id = setInterval(() => void refetch(), POLL_MS);
    return () => clearInterval(id);
  }, [connection, refetch]);
}
