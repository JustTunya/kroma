import type { OrderStatus } from "@/lib/order-status";

/**
 * The pure half of "does this customer have something on the pass right now".
 * The hook (lib/use-active-order.ts) fetches; this file decides what counts and
 * what it says, so both are testable without a browser or a database.
 */

const TOKENS_KEY = "kroma-orders";
const TOKEN_LIMIT = 10;

/**
 * Order tokens collected in this browser, newest first. A guest has no account,
 * so this list is their only way back to an order they placed.
 */
export function recentOrderTokens(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TOKENS_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function rememberOrderToken(token: string): void {
  if (typeof window === "undefined") return;
  const stored = recentOrderTokens();
  if (stored.includes(token)) return;
  try {
    window.localStorage.setItem(
      TOKENS_KEY,
      JSON.stringify([token, ...stored].slice(0, TOKEN_LIMIT)),
    );
  } catch {
    // Private mode or a full quota — the order still works, it is just not remembered.
  }
}

/**
 * An unsettled order from this morning is still live; one from yesterday was
 * abandoned and must not sit in the header forever. Pairs with isSettled() —
 * status says whether it finished, this says whether anyone still cares.
 */
const LIVE_MS = 6 * 60 * 60_000;

export function isRecent(placedAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(placedAt).getTime() < LIVE_MS;
}

/**
 * What the pill says after the status word. Null when there is no time left to
 * give: a ready order is waiting, not cooking, and an order with no pickup time
 * has nothing to count down to. Rounded up — "0 min" reads as broken.
 */
export function pickupCountdown(
  status: OrderStatus,
  pickupAt: string | null,
  now: Date = new Date(),
): string | null {
  if (status === "ready" || !pickupAt) return null;

  const minutes = Math.ceil((new Date(pickupAt).getTime() - now.getTime()) / 60_000);
  return minutes > 0 ? `${minutes} min` : "Any minute";
}
