"use client";

import { useCallback, useEffect, useState } from "react";

import {
  cartCount,
  clearGuestCart,
  mergeCarts,
  readGuestCart,
  writeGuestCart,
  type CartLine,
} from "@/lib/cart";
import { readServerCart, writeServerCart } from "@/lib/cart-sync";

/**
 * The one cart owner. Guests live in localStorage, signed-in customers in the
 * `carts` table; signing in merges the two.
 *
 * `ready` is false until hydration finishes — /checkout must not decide the
 * cart is empty before it has been read.
 */
export function useCart(signedIn: boolean) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  // ponytail: hydrate once on mount / sign-in change; no realtime cross-tab sync yet.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!signedIn) {
        if (!cancelled) {
          setLines(readGuestCart());
          setReady(true);
        }
        return;
      }

      const guestCart = readGuestCart();
      const serverCart = await readServerCart();
      const merged = guestCart.length ? mergeCarts(serverCart, guestCart) : serverCart;

      if (guestCart.length) {
        try {
          await writeServerCart(merged);
          clearGuestCart();
        } catch (error) {
          // Server write failed — keep the guest copy so nothing is lost.
          console.error("cart merge failed:", error);
        }
      }

      if (!cancelled) {
        setLines(merged);
        setReady(true);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const persist = useCallback(
    (next: CartLine[]) => {
      setLines(next);
      if (signedIn) {
        writeServerCart(next).catch((error) => console.error("cart write failed:", error));
      } else {
        writeGuestCart(next);
      }
    },
    [signedIn],
  );

  return {
    lines,
    ready,
    count: cartCount(lines),
    add: (line: CartLine) => persist(mergeCarts(lines, [line])),
    setQuantity: (lineId: string, quantity: number) =>
      persist(lines.map((line) => (line.id === lineId ? { ...line, quantity } : line))),
    remove: (lineId: string) => persist(lines.filter((line) => line.id !== lineId)),
    clear: () => persist([]),
  };
}
