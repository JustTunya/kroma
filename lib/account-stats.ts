const ZONE = "Europe/Bucharest";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DAYS_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const parts = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
  timeZone: ZONE,
});

export type Rhythm = {
  byDay: number[];
  peakDay: number | null;
  peakHour: number | null;
  total: number;
};

// Ties resolve to the earliest day / hour so the answer is stable between renders.
function argmax(values: number[]): number | null {
  let best: number | null = null;
  values.forEach((value, index) => {
    if (value > 0 && (best === null || value > values[best])) best = index;
  });
  return best;
}

export function rhythm(placedAt: string[]): Rhythm {
  const byDay = Array<number>(7).fill(0);
  const byHour = Array<number>(24).fill(0);

  for (const value of placedAt) {
    const found = parts.formatToParts(new Date(value));
    const day = DAYS.indexOf(found.find((p) => p.type === "weekday")?.value as never);
    const hour = Number(found.find((p) => p.type === "hour")?.value);

    if (day < 0 || Number.isNaN(hour)) continue;
    byDay[day] += 1;
    byHour[hour] += 1;
  }

  return {
    byDay,
    peakDay: argmax(byDay),
    peakHour: argmax(byHour),
    total: byDay.reduce((sum, n) => sum + n, 0),
  };
}

export type Modifier = { group: string; option: string; priceOffset: number };

export type HistoryOrder = {
  order_items: {
    menu_item_id: string | null;
    item_name: string;
    quantity: number;
    selected_modifiers: Modifier[];
  }[];
};

// `orders` must be newest first: the first modifier set seen per item is its latest.
export function tally(orders: HistoryOrder[]) {
  const items = new Map<
    string,
    { id: string; name: string; quantity: number; modifiers: Modifier[] }
  >();

  for (const order of orders) {
    for (const line of order.order_items) {
      if (!line.menu_item_id) continue;

      const seen = items.get(line.menu_item_id);
      if (seen) seen.quantity += line.quantity;
      else
        items.set(line.menu_item_id, {
          id: line.menu_item_id,
          name: line.item_name,
          quantity: line.quantity,
          modifiers: line.selected_modifiers,
        });
    }
  }

  return [...items.values()].sort((a, b) => b.quantity - a.quantity);
}
