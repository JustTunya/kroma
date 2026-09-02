/**
 * Counting the drawer.
 *
 * Everything totals in integer cents and divides once at the end: a drawer that
 * is out by €0.01 because of binary floating point is a drawer someone spends
 * twenty minutes recounting.
 */

/** Euro notes and coins, largest first. €500/€200/€100 are not kept in a café till. */
export const DENOMINATIONS = [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1] as const;

export function countTotal(counts: Record<string, number>): number {
  let cents = 0;
  for (const denomination of DENOMINATIONS) {
    const n = counts[String(denomination)];
    if (!Number.isInteger(n) || n < 0) continue;
    cents += Math.round(denomination * 100) * n;
  }
  return cents / 100;
}

/** Operational words, not "variance". Square is the reward for a careful count. */
export function varianceWord(diff: number): { word: string; tone: "live" | "alert" } {
  if (Math.abs(diff) < 0.005) return { word: "Square", tone: "live" };
  return { word: diff > 0 ? "Over by" : "Short by", tone: "alert" };
}
