"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { motion } from "framer-motion";

import {
  LEDGER_CATEGORY_NAMES,
  RANGE_PRESETS,
  shiftDayKey,
  type DateRange,
} from "@/lib/manage";
import { pressSpring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Every filter on the page, in the URL.
 *
 * State lives in the query string rather than in React so a manager can send
 * "look at last Tuesday" as a link, and so the back button walks the windows
 * they actually looked at. Nothing here holds a value of its own.
 *
 * The date fields are the browser's own `<input type="date">`: it already
 * knows the locale, the keyboard, and how to open a calendar on a phone.
 */
export function FilterRail({
  range,
  staff,
  today,
  categories,
  staffId,
}: {
  range: DateRange;
  staff: { id: string; display_name: string }[];
  today: string;
  categories: string[];
  staffId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  /** Every control routes through here. `null` removes the key entirely. */
  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // A new window means the old page of the ledger is meaningless.
    if (!("page" in changes)) next.delete("page");
    start(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }

  function toggleCategory(name: string) {
    const next = categories.includes(name)
      ? categories.filter((c) => c !== name)
      : [...categories, name];
    go({ cat: next.join(",") });
  }

  return (
    <div
      // Parks under the h-14 staff bar, so the window you are reading is
      // still named when you have scrolled down into the ledger.
      className={cn(
        "sticky top-14 z-30 border-b border-kds-border bg-kds-canvas/95 backdrop-blur-xl",
        "px-5 transition-opacity sm:px-10 lg:px-14",
        pending && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-4 py-4">
        {RANGE_PRESETS.map((preset) => (
          <Pill
            key={preset.id}
            active={range.preset === preset.id}
            onClick={() =>
              go({ from: shiftDayKey(today, -preset.days), to: today })
            }
          >
            {preset.label}
          </Pill>
        ))}

        <span aria-hidden className="mx-1 h-4 w-px bg-kds-border" />

        <label className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
          From
          <DateField
            value={range.fromKey}
            max={range.toKey}
            onChange={(value) => go({ from: value })}
          />
        </label>
        <label className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
          To
          <DateField
            value={range.toKey}
            min={range.fromKey}
            max={today}
            onChange={(value) => go({ to: value })}
          />
        </label>

        <span aria-hidden className="mx-1 hidden h-4 w-px bg-kds-border sm:block" />

        <label className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
          Who
          <select
            value={staffId ?? ""}
            onChange={(event) => go({ staff: event.target.value || null })}
            className="h-9 rounded-md border border-kds-border bg-transparent px-3 font-mono text-[11px] tracking-[0.02em] text-kds-text-primary normal-case focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
          >
            <option value="" className="bg-kds-canvas">
              Everyone
            </option>
            {staff.map((person) => (
              <option key={person.id} value={person.id} className="bg-kds-canvas">
                {person.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-4">
        <span className="shrink-0 pr-1 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
          Ledger
        </span>
        <Pill active={categories.length === 0} onClick={() => go({ cat: null })}>
          Everything
        </Pill>
        {LEDGER_CATEGORY_NAMES.map((name) => (
          <Pill
            key={name}
            active={categories.includes(name)}
            onClick={() => toggleCategory(name)}
          >
            {name}
          </Pill>
        ))}
      </div>
    </div>
  );
}

function DateField({
  value,
  min,
  max,
  onChange,
}: {
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(event) => event.target.value && onChange(event.target.value)}
      className="h-9 rounded-md border border-kds-border bg-transparent px-3 font-mono text-[11px] tracking-[0.02em] text-kds-text-primary tabular-nums [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
    />
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileTap={{ scale: 0.98 }}
      transition={pressSpring}
      className={cn(
        "flex h-9 shrink-0 items-center rounded-full px-4 font-mono text-[10px] font-medium",
        "tracking-[0.16em] uppercase transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
        active
          ? "bg-kds-text-primary text-kds-canvas"
          : "text-kds-text-secondary hover:text-kds-text-primary",
      )}
    >
      {children}
    </motion.button>
  );
}
