"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useReportBoardStatus } from "@/components/dashboard/BoardStatus";
import { createClient } from "@/lib/client";

import type { BoardOrder } from "@/types/board";

const POLL_MS = 30_000;

export function useBoard(initial: BoardOrder[]) {
  const [orders, setOrders] = useState(initial);
  const report = useReportBoardStatus();

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

      report({ connection: null });
    };
  }, [refetch, report]);

  return { orders, refetch };
}

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
