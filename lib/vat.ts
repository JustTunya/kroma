/**
 * The TypeScript half of vat_of(). Prices are gross everywhere — on the menu,
 * in the cart, on the receipt — so VAT is always a fact ABOUT the total, never
 * an addition to it. Keep this in step with the SQL function; both round to the
 * cent, and a UI that disagrees with the books by a cent is worse than one that
 * shows nothing.
 */

export function vatOf(gross: number, rate: number): number {
  return Math.round((gross - gross / (1 + rate)) * 100) / 100;
}

/** `Incl. VAT 11%`. Whole percents only — no rate here has a fraction. */
export function vatLabel(rate: number): string {
  return `Incl. VAT ${Math.round(rate * 100)}%`;
}

export type RatedLine = { line_total: number; vat_rate: number };

/** One row per rate, ascending. A single-rate order yields one row. */
export function groupByRate(lines: RatedLine[]): { rate: number; gross: number; vat: number }[] {
  const totals = new Map<number, number>();
  for (const line of lines) {
    totals.set(line.vat_rate, (totals.get(line.vat_rate) ?? 0) + line.line_total);
  }
  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, gross]) => ({ rate, gross, vat: vatOf(gross, rate) }));
}
