/**
 * The trading day, as the interface talks about it.
 *
 * No date library: two formatters and a diff are twenty lines, and lib/manage.ts
 * already sets the precedent for doing shop-local dates with Intl.
 */

export type ServiceDay = {
  day: string;
  opened_at: string;
  opened_by: string | null;
  closed_at: string | null;
  next_number: number;
  float_cash: number;
  counted_cash: number | null;
};

/** A batch item on the opening screen. Unlimited items never appear here. */
export type ParItem = { id: string; name: string; par_stock: number };

/**
 * What the opening form actually needs to send. Anything left at par is left
 * out, so the payload names only what the person changed — which is also what
 * the audit row should record.
 */
export function parOverrides(
  items: ParItem[],
  counts: Record<string, number>,
): Record<string, number> {
  const overrides: Record<string, number> = {};
  for (const item of items) {
    const count = counts[item.id];
    // A blank or half-typed field means "as planned", never "none". Reading it
    // as zero would 86 the whole bake on one stray keystroke.
    if (!Number.isInteger(count) || count < 0) continue;
    if (count !== item.par_stock) overrides[item.id] = count;
  }
  return overrides;
}

/** `Wednesday 2 September` — how the bar would say it out loud. */
export function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
