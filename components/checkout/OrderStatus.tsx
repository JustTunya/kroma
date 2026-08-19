"use client";

import { useEffect, useState } from "react";

import { clearGuestCart } from "@/lib/cart";
import { readServerCart, writeServerCart } from "@/lib/cart-sync";
import { createClient } from "@/lib/client";

export type OrderDocItem = {
  item_name: string;
  base_price: number;
  quantity: number;
  selected_modifiers: { group: string; option: string; priceOffset: number }[];
  line_total: number;
};

export type OrderDoc = {
  id: string;
  order_number: number;
  status: "pending" | "paid" | "preparing" | "ready" | "collected" | "cancelled";
  customer_name: string | null;
  notes: string | null;
  subtotal: number;
  total: number;
  payment_method: "online" | "counter";
  placed_at: string;
  pickup_at: string | null;
  items: OrderDocItem[];
};

const SETTLED: OrderDoc["status"][] = ["collected", "cancelled"];

const LABELS: Record<OrderDoc["status"], { text: string; tone: string }> = {
  pending: { text: "On the pass", tone: "text-accent-primary" },
  paid: { text: "Paid — on the pass", tone: "text-badge-live" },
  preparing: { text: "Brewing now", tone: "text-badge-live" },
  ready: { text: "Ready at the bar", tone: "text-badge-live" },
  collected: { text: "Collected", tone: "text-text-tertiary" },
  cancelled: { text: "Cancelled", tone: "text-badge-alert" },
};

export function OrderStatus({ token, initial }: { token: string; initial: OrderDoc }) {
  const [order, setOrder] = useState(initial);

  // ponytail: last 10 order tokens in localStorage so a guest can find a recent
  // order. Replace with an account lookup if guests start losing them.
  useEffect(() => {
    try {
      const KEY = "kroma-orders";
      const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as string[];
      if (stored.includes(token)) return;
      window.localStorage.setItem(KEY, JSON.stringify([token, ...stored].slice(0, 10)));
    } catch {
      // Private mode or a full quota — the order still works, it is just not remembered.
    }
  }, [token]);

  // The order owns these lines now. Deliberately here and not at submit time:
  // an online order is only real once this page has confirmed the payment, and
  // until then the cart has to survive for a retry. Both calls are no-ops for
  // the side that does not apply — writeServerCart ignores guests.
  useEffect(() => {
    clearGuestCart();
    readServerCart()
      .then((lines) => (lines.length ? writeServerCart([]) : undefined))
      .catch((error) => console.error("cart clear failed:", error));
  }, []);

  // ponytail: polls every 15s. Realtime would need an RLS policy guests do not
  // have; swap to a channel if the poll load ever shows up.
  useEffect(() => {
    if (SETTLED.includes(order.status)) return;

    const supabase = createClient();
    const timer = setInterval(async () => {
      const { data } = await supabase.rpc("order_by_token", { p_token: token });
      if (data) setOrder(data as unknown as OrderDoc);
    }, 15_000);

    return () => clearInterval(timer);
  }, [token, order.status]);

  const label = LABELS[order.status];

  return (
    <p
      role="status"
      className={`font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${label.tone}`}
    >
      {label.text}
      {order.status === "pending" && order.payment_method === "counter" && (
        <>
          <span aria-hidden className="mx-3 text-hairline">
            /
          </span>
          Pay at the bar
        </>
      )}
    </p>
  );
}
