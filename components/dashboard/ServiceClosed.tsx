"use client";

import { useEffect, useState, useTransition } from "react";

import { openServiceAction } from "@/app/dashboard/actions";
import { dayLabel, parOverrides, type ParItem } from "@/lib/service-day";
import { shopDayKey } from "@/lib/manage";

/**
 * The first screen of the day, in the same slot ShiftStart occupies and for the
 * same reason: one deliberate tap beats a banner nobody presses. It is not a
 * splash — until it is answered the storefront is refusing orders.
 */
export function ServiceClosed({
  items,
  unlocked,
}: {
  items: ParItem[];
  unlocked: boolean;
}) {
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.par_stock])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function open() {
    setError(null);
    start(async () => {
      const result = await openServiceAction(parOverrides(items, counts));
      if (!result.ok) setError(result.error ?? "That did not go through.");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end overflow-y-auto bg-kds-canvas px-5 pb-16 sm:px-10 lg:px-14">
      <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
        Service
        <span aria-hidden className="mx-3 text-kds-border">/</span>
        {dayLabel(shopDayKey())}
      </p>

      <h1 className="mt-5 max-w-[16ch] font-serif text-[clamp(56px,10vw,148px)] leading-[0.92] tracking-[-0.03em]">
        Nothing is <em className="text-accent-primary">open</em> yet.
      </h1>

      {items.length > 0 && (
        <ul className="mt-10 max-w-lg divide-y divide-kds-border border-y border-kds-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-6 py-4">
              <span className="min-w-0 truncate font-mono text-[11px] font-medium tracking-[0.14em] uppercase">
                {item.name}
                <span aria-hidden className="mx-3 text-kds-border">/</span>
                <span className="text-kds-text-secondary">Par {item.par_stock}</span>
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={999}
                value={Number.isInteger(counts[item.id]) ? counts[item.id] : ""}
                onChange={(event) =>
                  setCounts((current) => ({
                    ...current,
                    [item.id]: event.target.valueAsNumber,
                  }))
                }
                aria-label={`How many ${item.name} today`}
                className="h-10 w-20 shrink-0 border-b border-kds-border bg-transparent text-right font-mono text-[15px] tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 font-mono text-[11px] font-medium tracking-[0.14em] text-kds-text-secondary uppercase">
        Espresso bar
        <span aria-hidden className="mx-3 text-kds-border">/</span>
        Unlimited
      </p>

      <button
        type="button"
        onClick={open}
        disabled={!unlocked || pending}
        className="mt-10 flex h-10 w-fit items-center rounded-full bg-accent-primary px-6 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:bg-kds-surface disabled:text-kds-text-secondary"
      >
        {pending ? "Opening" : "Open service"}
      </button>

      {!unlocked && (
        <p
          role="status"
          className="mt-4 font-mono text-[11px] tracking-[0.14em] text-accent-primary uppercase"
        >
          Unlock with your PIN to open the day.
        </p>
      )}

      {error && (
        <p
          role="status"
          className="mt-4 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase"
        >
          {error}
        </p>
      )}
    </div>
  );
}
