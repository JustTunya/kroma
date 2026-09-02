
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

export function varianceWord(diff: number): { word: string; tone: "live" | "alert" } {
  if (Math.abs(diff) < 0.005) return { word: "Square", tone: "live" };
  return { word: diff > 0 ? "Over by" : "Short by", tone: "alert" };
}
