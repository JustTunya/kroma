"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

  // Mirrors `lines` synchronously. `addMany`/`setQuantity`/`remove` read and write
  // this instead of the closed-over `lines` state, so N calls in the same tick
  // (e.g. ReorderButton's `for (const line of lines) add(line)`) each compose onto
  // the previous call's result instead of racing on the same stale render snapshot
  // — `setLines` alone wouldn't do this, since it only takes effect on the next render.
  const linesRef = useRef<CartLine[]>([]);

  // ponytail: hydrate once on mount / sign-in change; no realtime cross-tab sync yet.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!signedIn) {
        if (!cancelled) {
          const guestLines = readGuestCart();
          linesRef.current = guestLines;
          setLines(guestLines);
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
        linesRef.current = merged;
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
      linesRef.current = next;
      setLines(next);
      if (signedIn) {
        writeServerCart(next).catch((error) => console.error("cart write failed:", error));
      } else {
        writeGuestCart(next);
      }
    },
    [signedIn],
  );

  // Merges a whole batch onto `linesRef.current` in one persist call. `add` is
  // just `addMany` of one — one merge path, not two.
  const addMany = useCallback(
    (newLines: CartLine[]) => persist(mergeCarts(linesRef.current, newLines)),
    [persist],
  );

  return {
    lines,
    ready,
    count: cartCount(lines),
    add: (line: CartLine) => addMany([line]),
    addMany,
    setQuantity: (lineId: string, quantity: number) =>
      persist(
        linesRef.current.map((line) => (line.id === lineId ? { ...line, quantity } : line)),
      ),
    remove: (lineId: string) => persist(linesRef.current.filter((line) => line.id !== lineId)),
    clear: () => persist([]),
  };
}
