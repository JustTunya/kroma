
export type ServiceDay = {
  day: string;
  opened_at: string;
  opened_by: string | null;
  closed_at: string | null;
  next_number: number;
  float_cash: number;
  counted_cash: number | null;
};

export type ParItem = { id: string; name: string; par_stock: number };

export function parOverrides(
  items: ParItem[],
  counts: Record<string, number>,
): Record<string, number> {
  const overrides: Record<string, number> = {};
  for (const item of items) {
    const count = counts[item.id];

    if (!Number.isInteger(count) || count < 0) continue;
    if (count !== item.par_stock) overrides[item.id] = count;
  }
  return overrides;
}

export function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
