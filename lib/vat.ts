
export function vatOf(gross: number, rate: number): number {
  return Math.round((gross - gross / (1 + rate)) * 100) / 100;
}

export function vatLabel(rate: number): string {
  return `Incl. VAT ${Math.round(rate * 100)}%`;
}

export type RatedLine = { line_total: number; vat_rate: number };

export function groupByRate(lines: RatedLine[]): { rate: number; gross: number; vat: number }[] {
  const totals = new Map<number, number>();
  for (const line of lines) {
    totals.set(line.vat_rate, (totals.get(line.vat_rate) ?? 0) + line.line_total);
  }
  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, gross]) => ({ rate, gross, vat: vatOf(gross, rate) }));
}
