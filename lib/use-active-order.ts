"use client";

import { useEffect, useState } from "react";

import { isRecent, recentOrderTokens } from "@/lib/active-order";
import { createClient } from "@/lib/client";
import { isSettled, type OrderStatus } from "@/lib/order-status";

export type ActiveOrder = {
  order_number: number;
  status: OrderStatus;
  pickup_at: string | null;
};

const OPEN: OrderStatus[] = ["pending", "paid", "preparing", "ready"];

const POLL_MS = 15_000;

export function useActiveOrder(signedIn: boolean): ActiveOrder | null {
  const [order, setOrder] = useState<ActiveOrder | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function read(): Promise<ActiveOrder | null> {
      if (signedIn) {

        const { data } = await supabase
          .from("orders")
          .select("order_number, status, pickup_at, placed_at")
          .in("status", OPEN)
          .order("placed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return data && isRecent(data.placed_at) ? (data as ActiveOrder) : null;
      }

      const [token] = recentOrderTokens();
      if (!token) return null;

      const { data } = await supabase.rpc("order_by_token", { p_token: token });
      const guest = data as unknown as (ActiveOrder & { placed_at: string }) | null;

      if (!guest || isSettled(guest.status) || !isRecent(guest.placed_at)) return null;
      return guest;
    }

    async function tick() {
      try {
        const next = await read();
        if (!cancelled) setOrder(next);
      } catch (error) {
        console.error("active order read failed:", error);
      }
    }

    tick();

    const timer = setInterval(tick, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [signedIn]);

  return order;
}
