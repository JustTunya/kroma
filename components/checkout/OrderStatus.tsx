"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";

import { cancelOwnOrderAction } from "@/app/order/actions";
import { rememberOrderToken } from "@/lib/active-order";
import { clearGuestCart } from "@/lib/cart";
import { readServerCart, writeServerCart } from "@/lib/cart-sync";
import { createClient } from "@/lib/client";
import { pressSpring } from "@/lib/motion";
import { canCancelSelf } from "@/lib/order-transitions";
import { ORDER_STATUS_LABELS, isSettled, type OrderStatus } from "@/lib/order-status";

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
  day_number: number | null;
  status: OrderStatus;
  customer_name: string | null;
  notes: string | null;
  subtotal: number;
  total: number;
  payment_method: "online" | "counter";
  placed_at: string;
  pickup_at: string | null;
  items: OrderDocItem[];
};

export function OrderStatus({ token, initial }: { token: string; initial: OrderDoc }) {
  const [order, setOrder] = useState(initial);
  // Two presses, no modal. Cancelling an order you did mean to place is as bad
  // as the accident it undoes, and a sheet over a confirmation page is heavier
  // than the decision.
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The guest's own record of the order: no account, so the token in
  // localStorage is the only way back to it — and the header pill reads the
  // same list to know there is something on the pass.
  useEffect(() => {
    rememberOrderToken(token);
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
    if (isSettled(order.status)) return;

    const supabase = createClient();
    const timer = setInterval(async () => {
      const { data } = await supabase.rpc("order_by_token", { p_token: token });
      if (data) setOrder(data as unknown as OrderDoc);
    }, 15_000);

    return () => clearInterval(timer);
  }, [token, order.status]);

  function cancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelOwnOrderAction(token);
      // The action reports the status it landed on, not whether everything
      // worked: a failed refund still cancelled the order, and a refusal
      // ("already on the bar") left it exactly where it was.
      if (result.status) {
        setOrder((current) => ({ ...current, status: result.status! }));
      }
      setConfirming(false);
      if (!result.ok) setError(result.error ?? "Ask at the bar.");
    });
  }

  const label = ORDER_STATUS_LABELS[order.status];
  const cancellable = canCancelSelf(order.status);

  return (
    <>
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
        {order.status === "cancelled" && order.payment_method === "online" && !error && (
          <>
            <span aria-hidden className="mx-3 text-hairline">
              /
            </span>
            Back on your card in 5-10 days
          </>
        )}
      </p>

      {cancellable && (
        <motion.button
          type="button"
          // No blur reset: React dispatches blur before click, so disarming
          // there makes the second press a no-op. An armed button says
          // "Yes — cancel it" on its face, which is warning enough.
          onClick={() => (confirming ? cancel() : setConfirming(true))}
          disabled={pending}
          whileTap={{ scale: 0.98 }}
          transition={pressSpring}
          aria-label={
            confirming
              ? `Confirm cancelling order ${order.day_number ?? order.order_number}`
              : `Cancel order ${order.day_number ?? order.order_number}, €${order.total.toFixed(2)}`
          }
          className={`mt-5 h-9 rounded-full border px-4 font-mono text-[10px] font-medium tracking-[0.18em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:opacity-50 ${
            confirming
              ? "border-badge-alert text-badge-alert"
              : "border-hairline text-text-tertiary hover:border-badge-alert hover:text-badge-alert"
          }`}
        >
          {confirming ? "Yes — cancel it" : "Cancel this order"}
        </motion.button>
      )}

      {cancellable && (
        <p className="mt-3 max-w-md font-mono text-[10px] tracking-[0.14em] text-text-tertiary uppercase">
          Only until the bar starts it
        </p>
      )}

      {error && (
        <p
          role="status"
          className="mt-3 font-mono text-[11px] font-medium tracking-[0.14em] text-badge-alert uppercase"
        >
          {error}
        </p>
      )}
    </>
  );
}
