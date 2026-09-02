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

export function useCart(signedIn: boolean) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  const linesRef = useRef<CartLine[]>([]);

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
