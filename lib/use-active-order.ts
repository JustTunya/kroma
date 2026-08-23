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

/** Statuses that still have something happening to them. */
const OPEN: OrderStatus[] = ["pending", "paid", "preparing", "ready"];

// ponytail: polls every 15s, same as the confirmation page. Realtime would need
// an RLS policy guests do not have; swap to a channel if the poll load shows up.
const POLL_MS = 15_000;

/**
 * The one order the header speaks for: the customer's most recent order that
 * the bar has not finished with. Null when there is nothing on the pass, and
 * the header shows nothing at all.
 *
 * Two ways in, because there are two kinds of customer: a signed-in one reads
 * their own rows through the "orders read own" policy, a guest holds a token in
 * localStorage and trades it for one order through order_by_token().
 */
export function useActiveOrder(signedIn: boolean): ActiveOrder | null {
  const [order, setOrder] = useState<ActiveOrder | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function read(): Promise<ActiveOrder | null> {
      if (signedIn) {
        // No .eq("user_id", …) on purpose: the policy scopes this, exactly as
        // it does on the account's order history.
        const { data } = await supabase
          .from("orders")
          .select("order_number, status, pickup_at, placed_at")
          .in("status", OPEN)
          .order("placed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return data && isRecent(data.placed_at) ? (data as ActiveOrder) : null;
      }

      // Newest first, so the head of the list is the only candidate.
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
    // Also the clock: every tick re-renders the countdown, not just the status.
    const timer = setInterval(tick, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [signedIn]);

  return order;
}
