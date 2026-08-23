/**
 * The date window and the vocabulary behind /dashboard/numbers.
 *
 * No dependency: a range picker, a duration formatter and a day key are about
 * sixty lines between them, and every date library on npm is larger than the
 * page that would import it.
 */

/**
 * The shop is in Cluj-Napoca and the server is in UTC. "Today" has to mean the
 * day the bar had, or the morning's takings land on yesterday for three hours
 * every evening. Matches shop_tz() in the migration — change both together.
 */
export const SHOP_TZ = "Europe/Bucharest";

/** How far the shop clock is ahead of UTC at a given instant, in ms. */
function shopOffset(at: Date): number {
  // sv-SE formats as `2026-08-23 14:05:03`, which is ISO once the space
  // becomes a T. Reading it back as UTC gives the wall clock as an instant,
  // and the gap to the real instant is the offset.
  const wall = new Intl.DateTimeFormat("sv-SE", {
    timeZone: SHOP_TZ,
    dateStyle: "short",
    timeStyle: "medium",
    hour12: false,
  }).format(at);
  return Date.parse(wall.replace(" ", "T") + "Z") - at.getTime();
}

/** `YYYY-MM-DD` for the shop day an instant falls in. */
export function shopDayKey(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TZ }).format(at);
}

/** The instant a shop day begins. */
export function shopDayStart(key: string): Date {
  const utcMidnight = Date.parse(`${key}T00:00:00Z`);
  // Two passes. The first offset is read at noon UTC, which is never inside a
  // DST switch in any zone; the second is read at the answer, which corrects
  // the one day a year where midnight sits on the wrong side of the change.
  const guess = new Date(utcMidnight - shopOffset(new Date(`${key}T12:00:00Z`)));
  return new Date(utcMidnight - shopOffset(guess));
}

/** Shifts a `YYYY-MM-DD` key by whole days, staying on the shop calendar. */
export function shiftDayKey(key: string, days: number): string {
  return shopDayKey(new Date(shopDayStart(key).getTime() + days * 86_400_000 + 43_200_000));
}

export const RANGE_PRESETS = [
  { id: "today", label: "Today", days: 0 },
  { id: "7", label: "7 days", days: 6 },
  { id: "30", label: "30 days", days: 29 },
] as const;

/** Longest window the page will ask for. Beyond this it stops being a glance. */
const MAX_DAYS = 366;

export type DateRange = {
  /** Inclusive `YYYY-MM-DD` bounds, as the date inputs carry them. */
  fromKey: string;
  toKey: string;
  /** Half-open instants, which is what the RPCs take. */
  from: Date;
  to: Date;
  days: number;
  /** Which preset button is lit, if any. */
  preset: string | null;
};

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads the window out of the URL. Anything missing or malformed falls back to
 * today rather than erroring — a hand-edited query string should not be able
 * to blank the page.
 */
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
    // Half-open: the day named by toKey is included, up to but not including
    // the next midnight.
    to: shopDayStart(shiftDayKey(toKey, 1)),
    days,
    preset,
  };
}

// ------------------------------------------------------------------- ledger

/**
 * Filter groups over the audit trail. Named for what a manager is looking for,
 * not for the prefix on the action string.
 */
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

/** Chosen categories → the flat action list the RPC filters on. */
export function actionsFor(categories: string[]): string[] | null {
  const picked = categories.filter(
    (name): name is LedgerCategory => name in LEDGER_CATEGORIES,
  );
  // No selection means everything, and passing every action explicitly would
  // silently drop any action added to the schema later.
  if (picked.length === 0) return null;
  return picked.flatMap((name) => [...LEDGER_CATEGORIES[name]]);
}

/**
 * How one event reads in the ledger. `%s` is the subject, already worded by
 * the caller, because only it knows whether the row resolved to an order
 * number or a menu item.
 *
 * ponytail: OrderDetail keeps its own shorter phrasing for the same actions —
 * that trail runs under one order, so it says "it" where this says "#042".
 * Merge them the day a third surface needs the words.
 */
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

/** Which tone the row carries. Money leaving is the only thing worth colour. */
export function ledgerTone(action: string): string {
  if (LEDGER_CATEGORIES.Money.includes(action as never)) return "text-badge-alert";
  if (action === "item.86" || action === "staff.locked") return "text-accent-primary";
  return "text-kds-text-primary";
}

// --------------------------------------------------------------------- tape

/** Pixels the service tape gives a column of ticks. Nothing draws past it. */
export const TAPE_STACK = 180;
/** Below this a tick stops being legible, so it starts counting more than one. */
const MIN_PITCH = 3;

/**
 * How the tape draws `busiest` orders in TAPE_STACK pixels.
 *
 * One tick is one order until a month of Saturdays stops fitting — 180px of
 * 3px ticks is sixty of them — and past that a tick counts several and the key
 * says how many. Silently clipping the stack would draw a busy hour as a calm
 * one, which is the one thing this element exists to prevent.
 */
export function tapeScale(busiest: number): { perTick: number; pitch: number } {
  const capacity = Math.floor(TAPE_STACK / MIN_PITCH);
  const perTick = Math.max(1, Math.ceil(busiest / capacity));
  const ticks = Math.max(Math.round(busiest / perTick), 1);
  return { perTick, pitch: Math.max(MIN_PITCH, Math.min(6, Math.floor(TAPE_STACK / ticks))) };
}

// ------------------------------------------------------------------ display

/** `4h 20m`, `12m`, `48s`. Never `0h 0m 48s`. */
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

/** `07` — the tape's axis labels, which are hours and not times of day. */
export const hourLabel = (hour: number) => String(hour).padStart(2, "0");
