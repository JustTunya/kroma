
export const SHOP_TZ = "Europe/Bucharest";

function shopOffset(at: Date): number {

  const wall = new Intl.DateTimeFormat("sv-SE", {
    timeZone: SHOP_TZ,
    dateStyle: "short",
    timeStyle: "medium",
    hour12: false,
  }).format(at);
  return Date.parse(wall.replace(" ", "T") + "Z") - at.getTime();
}

export function shopDayKey(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TZ }).format(at);
}

export function shopDayStart(key: string): Date {
  const utcMidnight = Date.parse(`${key}T00:00:00Z`);

  const guess = new Date(utcMidnight - shopOffset(new Date(`${key}T12:00:00Z`)));
  return new Date(utcMidnight - shopOffset(guess));
}

export function shiftDayKey(key: string, days: number): string {
  return shopDayKey(new Date(shopDayStart(key).getTime() + days * 86_400_000 + 43_200_000));
}

export const RANGE_PRESETS = [
  { id: "today", label: "Today", days: 0 },
  { id: "7", label: "7 days", days: 6 },
  { id: "30", label: "30 days", days: 29 },
] as const;

const MAX_DAYS = 366;

export type DateRange = {

  fromKey: string;
  toKey: string;

  from: Date;
  to: Date;
  days: number;

  preset: string | null;
};

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function readRange(
  params: { from?: string; to?: string },
  today: string = shopDayKey(),
): DateRange {
  const toKey =
    params.to && DAY_KEY.test(params.to) && params.to <= today ? params.to : today;

  let fromKey =
    params.from && DAY_KEY.test(params.from) && params.from <= toKey
      ? params.from
      : toKey;

  const span = Math.round(
    (shopDayStart(toKey).getTime() - shopDayStart(fromKey).getTime()) / 86_400_000,
  );
  if (span > MAX_DAYS) fromKey = shiftDayKey(toKey, -MAX_DAYS);

  const days =
    Math.round(
      (shopDayStart(toKey).getTime() - shopDayStart(fromKey).getTime()) / 86_400_000,
    ) + 1;

  const preset =
    toKey === today
      ? (RANGE_PRESETS.find((p) => p.days === days - 1)?.id ?? null)
      : null;

  return {
    fromKey,
    toKey,
    from: shopDayStart(fromKey),

    to: shopDayStart(shiftDayKey(toKey, 1)),
    days,
    preset,
  };
}

export const LEDGER_CATEGORIES = {
  Shifts: ["shift.start", "shift.end", "staff.unlock", "staff.locked"],
  Orders: ["order.advance", "order.claim", "order.note", "order.undo_late"],
  Money: [
    "order.void",
    "order.refund",
    "order.discount",
    "order.abandon",
    "order.cancel_self",
  ],
  Stock: ["item.86"],
} as const satisfies Record<string, readonly string[]>;

export type LedgerCategory = keyof typeof LEDGER_CATEGORIES;

export const LEDGER_CATEGORY_NAMES = Object.keys(
  LEDGER_CATEGORIES,
) as LedgerCategory[];

export function actionsFor(categories: string[]): string[] | null {
  const picked = categories.filter(
    (name): name is LedgerCategory => name in LEDGER_CATEGORIES,
  );

  if (picked.length === 0) return null;
  return picked.flatMap((name) => [...LEDGER_CATEGORIES[name]]);
}

export const LEDGER_WORDS: Record<string, string> = {
  "shift.start": "started a shift",
  "shift.end": "ended their shift",
  "staff.unlock": "unlocked the terminal",
  "staff.locked": "was locked out after five wrong PINs",
  "order.advance": "moved %s on",
  "order.claim": "took %s",
  "order.note": "left a note on %s",
  "order.undo_late": "stepped %s back",
  "order.void": "voided %s",
  "order.refund": "refunded %s",
  "order.discount": "discounted %s",
  "order.abandon": "marked %s not collected",
  "order.cancel_self": "%s was cancelled from the customer's phone",
  "item.86": "86'd %s",
};

export function ledgerTone(action: string): string {
  if (LEDGER_CATEGORIES.Money.includes(action as never)) return "text-badge-alert";
  if (action === "item.86" || action === "staff.locked") return "text-accent-primary";
  return "text-kds-text-primary";
}

export const TAPE_STACK = 180;

const MIN_PITCH = 3;

export function tapeScale(busiest: number): { perTick: number; pitch: number } {
  const capacity = Math.floor(TAPE_STACK / MIN_PITCH);
  const perTick = Math.max(1, Math.ceil(busiest / capacity));
  const ticks = Math.max(Math.round(busiest / perTick), 1);
  return { perTick, pitch: Math.max(MIN_PITCH, Math.min(6, Math.floor(TAPE_STACK / ticks))) };
}

export function duration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

export const euros = (amount: number) => `€${amount.toFixed(2)}`;

export const hourLabel = (hour: number) => String(hour).padStart(2, "0");
