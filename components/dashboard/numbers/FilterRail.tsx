"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";

import {
  LEDGER_CATEGORY_NAMES,
  RANGE_PRESETS,
  shiftDayKey,
  type DateRange,
} from "@/lib/manage";
import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Every filter on the page, in the URL.
 *
 * State lives in the query string rather than in React so a manager can send
 * "look at last Tuesday" as a link, and so the back button walks the windows
 * they actually looked at. Nothing here holds a value of its own.
 *
 * Two lines, because there are two scopes and they are not the same: the
 * window on top governs the whole page, the ledger line under it governs only
 * the last section. Reading it top to bottom says so.
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const still = useReducedMotion();

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

  // What the trigger reads on mobile, since the sheet it opens is hidden
  // until tapped: the one line has to say the whole state of the filter.
  const activePreset = RANGE_PRESETS.find((preset) => preset.id === range.preset);
  const windowText = activePreset
    ? activePreset.label
    : range.days > 1
      ? `${dayLabel(range.fromKey, today)} – ${dayLabel(range.toKey, today)}`
      : dayLabel(range.toKey, today);
  const ledgerText = categories.length === 0 ? "Everything" : categories.join(" / ");
  const staffText = staffId
    ? (staff.find((person) => person.id === staffId)?.display_name ?? "Someone")
    : "Everyone";
  const activeCount = categories.length + (staffId ? 1 : 0);

  // Desktop's own window control, same idea as the mobile sheet: a segmented
  // row of buttons, dates only surface once "Custom" is picked so a plain
  // preset window doesn't cost the row two date fields' worth of space.
  const [customOpen, setCustomOpen] = useState(range.preset === null);

  return (
    <div
      aria-busy={pending}
      // Parks under the h-14 staff bar, so the window you are reading is
      // still named when you have scrolled down into the ledger.
      className="sticky top-14 z-30 border-b border-kds-border bg-kds-canvas/95 px-5 backdrop-blur-xl sm:px-10 lg:px-14"
    >
      {/* Mobile: one line, one control. A sticky bar that spent two rows
          arguing with itself over scroll space was the actual problem — this
          reads the state at a glance and opens everything at once below. */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        aria-label={`Filters — ${windowText}, ${ledgerText}, ${staffText}`}
        className="flex w-full items-center gap-3 py-3.5 text-left lg:hidden"
      >
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-medium tracking-[0.1em] text-kds-text-primary uppercase tabular-nums">
          {windowText}
          <span aria-hidden className="mx-2 text-kds-border">
            /
          </span>
          <span className="text-kds-text-secondary">{ledgerText}</span>
          <span aria-hidden className="mx-2 text-kds-border">
            /
          </span>
          <span className="text-kds-text-secondary">{staffText}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-kds-border py-1.5 pr-3 pl-2.5 font-mono text-[10px] font-medium tracking-[0.14em] text-kds-text-secondary uppercase">
          <SlidersHorizontal aria-hidden size={12} strokeWidth={2} />
          Filters
          {activeCount > 0 && (
            <span
              aria-hidden
              className="flex size-3.5 items-center justify-center rounded-full bg-accent-primary text-[9px] text-kds-canvas tabular-nums"
            >
              {activeCount}
            </span>
          )}
        </span>
      </button>

      {/* Desktop: the window, then the ledger's own lens, both on their own
          row — untouched by the mobile redesign above. */}
      <div className="hidden lg:block">
        {/* The window: a segmented row picks the preset, and only when
            "Custom" is lit do the two date fields show up — a plain preset
            window no longer pays rent for date text nobody is reading. */}
        <div className="flex h-14 items-center gap-x-6">
          <div className="-ml-4 flex shrink-0 items-center gap-1">
            {RANGE_PRESETS.map((preset) => (
              <Preset
                key={preset.id}
                active={!customOpen && range.preset === preset.id}
                onClick={() => {
                  setCustomOpen(false);
                  go({ from: shiftDayKey(today, -preset.days), to: today });
                }}
              >
                {preset.label}
              </Preset>
            ))}
            <Preset active={customOpen} onClick={() => setCustomOpen(true)}>
              Custom
            </Preset>
          </div>

          {customOpen && (
            <div className="flex shrink-0 items-baseline font-mono text-[10px] font-medium tracking-[0.16em] whitespace-nowrap uppercase tabular-nums">
              <DateField
                label="Window starts"
                value={range.fromKey}
                max={range.toKey}
                today={today}
                onChange={(value) => go({ from: value })}
              />
              <span aria-hidden className="mx-3 text-kds-border">
                —
              </span>
              <DateField
                label="Window ends"
                value={range.toKey}
                min={range.fromKey}
                max={today}
                today={today}
                onChange={(value) => go({ to: value })}
              />
              {range.days > 1 && (
                <span className="text-kds-text-secondary">
                  <span aria-hidden className="mx-3 text-kds-border">
                    /
                  </span>
                  {range.days} days
                </span>
              )}
            </div>
          )}
        </div>

        {/* The ledger's own lens, set as a spec line rather than a second row of
            chips: it reads as one sentence about which events are showing, and
            it stays quieter than the window it sits under. */}
        <div className="scrollbar-hide -mx-14 flex items-center overflow-x-auto px-14 pt-4 pb-3.5">
          <span className="shrink-0 pr-4 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
            Ledger
          </span>

          <Lens active={categories.length === 0} onClick={() => go({ cat: null })}>
            Everything
          </Lens>
          {LEDGER_CATEGORY_NAMES.map((name) => (
            <span key={name} className="flex shrink-0 items-center">
              <Slash />
              <Lens
                active={categories.includes(name)}
                onClick={() => toggleCategory(name)}
              >
                {name}
              </Lens>
            </span>
          ))}

          <label className="ml-auto flex shrink-0 items-center gap-2 pl-6 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
            Staff
            <StaffSelect staffId={staffId} staff={staff} onChange={(id) => go({ staff: id })} />
          </label>
        </div>
      </div>

      {/* Re-reading the numbers. A terracotta hairline running the bottom edge
          rather than a dimmed bar: the labels you are aiming at stay legible. */}
      {pending && (
        <span
          aria-hidden
          className="absolute inset-x-0 -bottom-px h-px overflow-hidden"
        >
          {still ? (
            <span className="absolute inset-0 bg-accent-primary/50" />
          ) : (
            <motion.span
              className="absolute inset-y-0 w-1/3 bg-accent-primary"
              initial={{ x: "-100%" }}
              animate={{ x: "300%" }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            />
          )}
        </span>
      )}

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        range={range}
        today={today}
        categories={categories}
        staffId={staffId}
        staff={staff}
        go={go}
        toggleCategory={toggleCategory}
      />
    </div>
  );
}

/** The mobile sheet: every control the desktop row has, at thumb size, with
    nothing off the edge of the screen. */
function FilterSheet({
  open,
  onClose,
  range,
  today,
  categories,
  staffId,
  staff,
  go,
  toggleCategory,
}: {
  open: boolean;
  onClose: () => void;
  range: DateRange;
  today: string;
  categories: string[];
  staffId: string | null;
  staff: { id: string; display_name: string }[];
  go: (changes: Record<string, string | null>) => void;
  toggleCategory: (name: string) => void;
}) {
  // Which of the four window buttons reads as pressed. Starts on "custom"
  // when the URL is already outside the three presets, so reopening the
  // sheet mid-custom-range doesn't hide the dates that are actually active.
  const [activeTab, setActiveTab] = useState<string>(range.preset ?? "custom");

  // Portalled to <body>: a sticky ancestor up the tree carries
  // backdrop-blur-xl, which — like `filter` and `transform` — makes that
  // ancestor the containing block for anything `fixed` inside it. Left in
  // place, the sheet would pin to that small bar instead of the viewport.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={spring}
            className="relative flex max-h-[85vh] w-full flex-col overflow-hidden border-t border-kds-border bg-kds-canvas"
          >
            <div className="flex items-center justify-between gap-4 border-b border-kds-border p-6">
              <h2 className="font-serif text-[28px] leading-[1.05] tracking-[-0.02em] text-kds-text-primary">
                Filters
              </h2>
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={{ scale: 0.98 }}
                transition={pressSpring}
                aria-label="Close filters"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-kds-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
              >
                <X aria-hidden size={16} strokeWidth={2} />
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <section aria-label="Window">
                <Eyebrow>Window</Eyebrow>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {RANGE_PRESETS.map((preset) => (
                    <Chip
                      key={preset.id}
                      active={activeTab === preset.id}
                      onClick={() => {
                        setActiveTab(preset.id);
                        go({ from: shiftDayKey(today, -preset.days), to: today });
                      }}
                    >
                      {preset.label}
                    </Chip>
                  ))}
                  <Chip active={activeTab === "custom"} onClick={() => setActiveTab("custom")}>
                    Custom
                  </Chip>
                </div>
                {activeTab === "custom" && (
                  <div className="mt-6 flex items-baseline justify-around gap-3 py-2 font-mono text-[17px] font-medium tracking-[0.06em] text-kds-text-primary uppercase tabular-nums">
                    <DateField
                      label="Window starts"
                      value={range.fromKey}
                      max={range.toKey}
                      today={today}
                      onChange={(value) => go({ from: value })}
                    />
                    <span aria-hidden className="text-kds-border">
                      —
                    </span>
                    <DateField
                      label="Window ends"
                      value={range.toKey}
                      min={range.fromKey}
                      max={today}
                      today={today}
                      onChange={(value) => go({ to: value })}
                    />
                  </div>
                )}
              </section>

              <section aria-label="Ledger" className="mt-9">
                <Eyebrow>Ledger</Eyebrow>
                <div className="mt-4 divide-y divide-kds-border border-y border-kds-border">
                  <LedgerRow
                    active={categories.length === 0}
                    onClick={() => go({ cat: null })}
                  >
                    Everything
                  </LedgerRow>
                  {LEDGER_CATEGORY_NAMES.map((name) => (
                    <LedgerRow
                      key={name}
                      active={categories.includes(name)}
                      onClick={() => toggleCategory(name)}
                    >
                      {name}
                    </LedgerRow>
                  ))}
                </div>
              </section>

              <section aria-label="Ledger — whose actions" className="mt-9">
                <Eyebrow>Staff</Eyebrow>
                <div className="relative mt-4">
                  <select
                    value={staffId ?? ""}
                    onChange={(event) => go({ staff: event.target.value || null })}
                    className="h-11 w-full appearance-none rounded-full border border-kds-border bg-kds-surface px-4 pr-10 font-mono text-[12px] font-medium tracking-[0.1em] text-kds-text-primary uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
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
                  <ChevronDown
                    aria-hidden
                    strokeWidth={1.75}
                    className="pointer-events-none absolute top-1/2 right-4 size-3.5 -translate-y-1/2 text-kds-text-secondary"
                  />
                </div>
              </section>
            </div>

            <div className="border-t border-kds-border p-6">
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={{ scale: 0.98 }}
                transition={pressSpring}
                className="flex h-11 w-full items-center justify-center rounded-full bg-kds-text-primary font-mono text-[11px] font-medium tracking-[0.14em] text-kds-canvas uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
              >
                Done
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Terracotta mono eyebrow — one per section of the filter sheet. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
      {children}
    </p>
  );
}

/** `23 Aug`, and the year too once the window crosses out of this one. */
function dayLabel(key: string, today: string): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(key.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }),
  });
}

/**
 * One end of the window. The value is drawn as text and the real input lies
 * over it at zero opacity, so the picker, the keyboard and the min/max clamp
 * are all still the browser's while the type is ours.
 */
function DateField({
  label,
  value,
  min,
  max,
  today,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  today: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center border-b border-kds-text-secondary py-2 transition-colors hover:border-accent-primary focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-kds-text-primary">
      <span aria-hidden>{dayLabel(value, today)}</span>
      <input
        type="date"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        // Anywhere on the field opens the calendar, not just a 16px icon.
        onClick={(event) => event.currentTarget.showPicker?.()}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0 [color-scheme:dark]"
      />
    </label>
  );
}

/** Who filter, shared by the mobile and desktop ledger lines. */
function StaffSelect({
  staffId,
  staff,
  onChange,
}: {
  staffId: string | null;
  staff: { id: string; display_name: string }[];
  onChange: (id: string | null) => void;
}) {
  return (
    <span className="relative flex items-center">
      <select
        value={staffId ?? ""}
        aria-label="Ledger — whose actions"
        onChange={(event) => onChange(event.target.value || null)}
        className="cursor-pointer appearance-none border-b border-kds-text-secondary bg-transparent pr-5 pb-0.5 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-primary uppercase transition-colors hover:border-accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kds-text-primary"
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
      <ChevronDown
        aria-hidden
        strokeWidth={1.75}
        className="pointer-events-none absolute right-0 size-3 text-kds-text-secondary"
      />
    </span>
  );
}

/** One of three windows, and only ever one of them. */
function Preset({
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
        "relative flex h-9 shrink-0 items-center rounded-full px-4 font-mono text-[10px] font-medium",
        "tracking-[0.16em] whitespace-nowrap uppercase transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
        active
          ? "text-kds-canvas"
          : "text-kds-text-secondary hover:text-kds-text-primary",
      )}
    >
      {active && (
        <motion.span
          layoutId="numbersRange"
          transition={spring}
          aria-hidden
          className="absolute inset-0 rounded-full bg-kds-text-primary"
        />
      )}
      <span className="relative">{children}</span>
    </motion.button>
  );
}

/** One term on the ledger's spec line. Any number of them can be on. */
function Lens({
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
        "shrink-0 border-b pb-0.5 font-mono text-[10px] font-medium tracking-[0.16em]",
        "whitespace-nowrap uppercase transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kds-text-primary",
        active
          ? "border-accent-primary text-kds-text-primary"
          : "border-transparent text-kds-text-secondary hover:text-kds-text-primary",
      )}
    >
      {children}
    </motion.button>
  );
}

/** One choice in the filter sheet — a window preset or a ledger category,
    sized for a thumb rather than a cursor. */
function Chip({
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
        "flex h-12 items-center justify-center rounded-full border px-4 font-mono text-[11px] font-medium",
        "tracking-[0.12em] whitespace-nowrap uppercase transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
        active
          ? "border-accent-primary bg-accent-primary text-kds-canvas"
          : "border-kds-border text-kds-text-secondary hover:border-kds-text-secondary hover:text-kds-text-primary",
      )}
    >
      {children}
    </motion.button>
  );
}

/** One category in the mobile Ledger filter — a full-width row rather than a
    pill, so several can sit stacked without wrapping unevenly, and each is
    a big enough target that a thumb doesn't clip the neighbor. */
function LedgerRow({
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
      whileTap={{ scale: 0.995 }}
      transition={pressSpring}
      className={cn(
        "flex h-12 w-full items-center justify-between font-mono text-[12px] font-medium",
        "tracking-[0.14em] uppercase transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
        active ? "text-kds-text-primary" : "text-kds-text-secondary",
      )}
    >
      {children}
      {active && <Check aria-hidden size={14} strokeWidth={2} className="text-accent-primary" />}
    </motion.button>
  );
}

function Slash() {
  return (
    <span aria-hidden className="px-2.5 font-mono text-[10px] text-kds-border">
      /
    </span>
  );
}
