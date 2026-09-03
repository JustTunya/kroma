"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { OrderSummary } from "@/components/checkout/OrderSummary";
import {
  DietaryWarning,
  flaggedLines,
  type DietaryIndex,
} from "@/components/checkout/DietaryWarning";
import { RedeemPicker } from "@/components/checkout/RedeemPicker";
import { placeOrder } from "@/app/checkout/actions";
import { isOrderable, toOrderPayload } from "@/lib/checkout";
import type { DietaryPrefs } from "@/lib/dietary";
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

const DETAILS_KEY = "kroma-checkout-details";

type Notice = "unfinished" | "refunded";

const NOTICES: Record<Notice, string> = {
  unfinished: "Card payment not completed. Nothing was charged. The order is still here.",
  refunded: "Card refunded — something on the order went while you were paying.",
};

function savedDetails(): { name?: string; notes?: string; email?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(DETAILS_KEY) ?? "null");
  } catch {

    return null;
  }
}

const NO_PREFS: DietaryPrefs = { diets: [], avoid: [] };

export function CheckoutForm({
  signedIn,
  defaultName,
  paymentNotice,
  serviceOpen,
  cardReady = false,
  eligibleDrinkIds = [],
  dietaryPrefs = NO_PREFS,
  dietaryIndex = {},
}: {
  signedIn: boolean;
  defaultName: string;
  paymentNotice?: Notice;
  serviceOpen: boolean;

  cardReady?: boolean;
  eligibleDrinkIds?: string[];
  dietaryPrefs?: DietaryPrefs;
  dietaryIndex?: DietaryIndex;
}) {
  const router = useRouter();
  const cart = useCart(signedIn);
  const [name, setName] = useState(() => savedDetails()?.name || defaultName);
  const [notes, setNotes] = useState(() => savedDetails()?.notes ?? "");
  const [email, setEmail] = useState(() => savedDetails()?.email ?? "");
  const [method, setMethod] = useState<Method>(paymentNotice ? "online" : "counter");
  const [error, setError] = useState<{ message: string; menuItemId?: string } | null>(
    paymentNotice ? { message: NOTICES[paymentNotice] } : null,
  );
  const [redeemPick, setRedeemPick] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const eligibleLines = cardReady
    ? cart.lines.filter((line, index, all) => {
        if (!eligibleDrinkIds.includes(line.menuItemId)) return false;
        return all.findIndex((other) => other.menuItemId === line.menuItemId) === index;
      })
    : [];

  // Falls back to null on its own once the picked item leaves the cart —
  // no effect needed, this is just a render-time clamp of stored state.
  const redeemItemId = eligibleLines.some((line) => line.menuItemId === redeemPick)
    ? redeemPick
    : null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await placeOrder({
        items: toOrderPayload(cart.lines),
        customerName: name,
        notes,
        paymentMethod: method,
        receiptEmail: signedIn ? undefined : email,
        redeemItemId: redeemItemId ?? undefined,
      });

      if (!result.ok) {
        setError({ message: result.message, menuItemId: result.menuItemId });
        return;
      }

      if (result.url.startsWith("/")) {

        cart.clear();
        router.push(result.url);
      } else {

        try {
          window.sessionStorage.setItem(DETAILS_KEY, JSON.stringify({ name, notes, email }));
        } catch {

        }
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

  if (!serviceOpen) {
    return (
      <p className={NOTE}>
        The bakehouse is closed. Orders reopen at 07:30 — your cart is still here.
      </p>
    );
  }

  if (!isOrderable(cart.lines)) {
    return (
      <p className={NOTE}>
        The menu is unavailable right now. Orders reopen when it is back.
      </p>
    );
  }

  const flagged = flaggedLines(cart.lines, dietaryPrefs, dietaryIndex);

  return (
    <>
      <DietaryWarning flagged={flagged} prefs={dietaryPrefs} />

      {eligibleLines.length > 0 && (
        <div className={cn(flagged.length > 0 && "mt-12")}>
          <RedeemPicker
            options={eligibleLines.map((line) => ({ menuItemId: line.menuItemId, name: line.name }))}
            value={redeemItemId}
            onChange={setRedeemPick}
          />
        </div>
      )}

      <form
        onSubmit={submit}
        className={cn(
          "grid gap-12 md:grid-cols-2 md:gap-0",
          (flagged.length > 0 || eligibleLines.length > 0) && "mt-12",
        )}
      >
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

        {!signedIn && (
          <label className="mt-10 block">
            <span className={LABEL}>Email for the receipt</span>
            <input
              type="email"
              maxLength={160}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Optional"
              className={FIELD}
            />
            <span className="mt-3 block font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
              Optional — for the receipt and a ping when it&rsquo;s ready.
            </span>
          </label>
        )}

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
          redeemItemId={redeemItemId ?? undefined}
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
    </>
  );
}
