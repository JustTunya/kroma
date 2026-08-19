"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { OrderSummary } from "@/components/checkout/OrderSummary";
import { placeOrder } from "@/app/checkout/actions";
import { isOrderable, toOrderPayload } from "@/lib/checkout";
import { pressSpring, spring } from "@/lib/motion";
import { useCart } from "@/lib/use-cart";
import { cn } from "@/lib/utils";

type Method = "counter" | "online";

const METHODS: { value: Method; label: string; note: string }[] = [
  { value: "counter", label: "Pay at the bar", note: "Card or cash when you collect" },
  { value: "online", label: "Pay now", note: "Card, Apple Pay, Google Pay" },
];

const FIELD =
  "mt-2 h-11 w-full border-b border-hairline bg-transparent font-mono text-[15px] tracking-[0.02em] text-text-primary placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

const LABEL =
  "font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase";

const NOTE =
  "border-y border-hairline py-10 font-mono text-[13px] tracking-[0.02em] text-text-secondary";

export function CheckoutForm({
  signedIn,
  defaultName,
}: {
  signedIn: boolean;
  defaultName: string;
}) {
  const router = useRouter();
  const cart = useCart(signedIn);
  const [name, setName] = useState(defaultName);
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<Method>("counter");
  const [error, setError] = useState<{ message: string; menuItemId?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await placeOrder({
        items: toOrderPayload(cart.lines),
        customerName: name,
        notes,
        paymentMethod: method,
      });

      if (!result.ok) {
        setError({ message: result.message, menuItemId: result.menuItemId });
        return;
      }

      // Clear before navigating: the order now owns these lines.
      cart.clear();

      if (result.url.startsWith("/")) {
        router.push(result.url);
      } else {
        window.location.href = result.url;
      }
    });
  }

  if (!cart.ready) {
    return <p className={NOTE}>Reading your order.</p>;
  }

  if (cart.lines.length === 0) {
    return <p className={NOTE}>Nothing on the pass yet.</p>;
  }

  if (!isOrderable(cart.lines)) {
    return (
      <p className={NOTE}>
        The menu is unavailable right now. Orders reopen when it is back.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-12 md:grid-cols-2 md:gap-0">
      <div className="md:pr-14">
        <label className="block">
          <span className={LABEL}>Name for the order</span>
          <input
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Called at the bar"
            className={FIELD}
          />
        </label>

        <label className="mt-10 block">
          <span className={LABEL}>Notes</span>
          <input
            maxLength={280}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional"
            className={FIELD}
          />
        </label>

        <fieldset className="mt-10">
          <legend className={LABEL}>Payment</legend>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {METHODS.map((option) => {
              const active = method === option.value;
              return (
                <motion.button
                  key={option.value}
                  type="button"
                  onClick={() => setMethod(option.value)}
                  whileTap={{ scale: 0.98 }}
                  transition={pressSpring}
                  aria-pressed={active}
                  className={cn(
                    "relative flex h-9 shrink-0 items-center rounded-full px-4 font-mono text-[10px] font-medium tracking-[0.16em] whitespace-nowrap uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                    active ? "text-surface-canvas" : "text-text-tertiary",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="activePaymentMethod"
                      transition={spring}
                      className="absolute inset-0 rounded-full bg-text-primary"
                      aria-hidden
                    />
                  )}
                  <span className="relative">{option.label}</span>
                </motion.button>
              );
            })}
          </div>
          <p className="mt-4 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
            {METHODS.find((option) => option.value === method)?.note}
          </p>
        </fieldset>
      </div>

      <div className="border-hairline md:border-l md:pl-14">
        <OrderSummary
          lines={cart.lines}
          errorItemId={error?.menuItemId}
          errorMessage={error?.message}
        />

        {error && !error.menuItemId && (
          <p
            role="status"
            className="mt-6 font-mono text-[11px] font-medium tracking-[0.14em] text-badge-alert uppercase"
          >
            {error.message}
          </p>
        )}

        <motion.button
          type="submit"
          disabled={pending}
          whileTap={{ scale: 0.98 }}
          transition={pressSpring}
          className="mt-8 flex h-10 w-full items-center justify-center rounded-full bg-accent-primary font-mono text-[11px] font-medium tracking-[0.14em] text-surface-card uppercase transition-colors duration-300 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:bg-surface-muted disabled:text-text-tertiary"
        >
          {pending ? "Sending to the pass" : method === "counter" ? "Place order" : "Pay now"}
        </motion.button>
      </div>
    </form>
  );
}
