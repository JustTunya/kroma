"use client";

import { Marquee, type MarqueeEntry } from "@/components/Marquee";
import type { MenuItem } from "@/types/menu";

/** The day as the bakehouse actually runs it: hours, plus what is left of each batch. */
function ledger(items: MenuItem[], serviceOpen: boolean): MarqueeEntry[] {
  const batches = items
    .filter((item) => item.daily_stock !== null)
    .map<MarqueeEntry>((item) => {
      const stock = item.daily_stock as number;

      if (stock === 0) return { label: `${item.name} — gone for today`, alert: true };

      return { label: `${item.name} — ${stock} left`, alert: stock <= 5 };
    });

  return [
    ...(serviceOpen ? [] : [{ label: "CLOSED", alert: true }]),
    { label: "07:30 doors open" },
    { label: "08:00 first bake" },
    ...batches,
    { label: "15:00 last bake" },
    { label: "18:00 close" },
  ];
}

export function DayLedger({ items, serviceOpen }: { items: MenuItem[]; serviceOpen: boolean }) {
  return <Marquee label="Today at the bakehouse" entries={ledger(items, serviceOpen)} />;
}
