import type { OrderStatus } from "@/lib/order-status";

const TOKENS_KEY = "kroma-orders";
const TOKEN_LIMIT = 10;

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

  }
}

const LIVE_MS = 6 * 60 * 60_000;

export function isRecent(placedAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(placedAt).getTime() < LIVE_MS;
}

export function pickupCountdown(
  status: OrderStatus,
  pickupAt: string | null,
  now: Date = new Date(),
): string | null {
  if (status === "ready" || !pickupAt) return null;

  const minutes = Math.ceil((new Date(pickupAt).getTime() - now.getTime()) / 60_000);
  return minutes > 0 ? `${minutes} min` : "Any minute";
}
