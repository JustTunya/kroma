/**
 * How long a thing has been waiting, in the only three states a bar cares
 * about. Drives the age spine on every row and the timer on the detail page,
 * so the two always agree about when an order has gone late.
 */
export type AgeTier = "fresh" | "warm" | "late";

const WARM_MS = 5 * 60_000;
const LATE_MS = 10 * 60_000;

export function ageTier(since: Date, now: Date = new Date()): AgeTier {
  const elapsed = now.getTime() - since.getTime();
  if (elapsed >= LATE_MS) return "late";
  if (elapsed >= WARM_MS) return "warm";
  return "fresh";
}

/**
 * Fill fraction for the spine. Clamped at both ends: a forgotten order stays
 * at full rather than overflowing, and a client clock running ahead of the
 * server reads as 0 rather than as a negative scale.
 */
export function ageFraction(since: Date, now: Date = new Date()): number {
  return Math.min(1, Math.max(0, (now.getTime() - since.getTime()) / LATE_MS));
}

/**
 * Half an hour on the bar means nobody is coming for it. The board says so and
 * sorts it to the top of its lane; it never cancels or refunds on its own.
 */
const STALE_MS = 30 * 60_000;

export function isStale(since: Date, now: Date = new Date()): boolean {
  return now.getTime() - since.getTime() >= STALE_MS;
}

/**
 * m:ss under the hour, h:mm over it. Never "about 3 minutes" — a bar reads
 * numbers. The hour case is not hypothetical: an order left overnight would
 * otherwise read 4697:19, which looks like a bug rather than a stale order.
 */
export function elapsedLabel(since: Date, now: Date = new Date()): string {
  const total = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 1000));
  const minutes = Math.floor(total / 60);

  if (minutes < 60) return `${minutes}:${String(total % 60).padStart(2, "0")}`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Spine and type colours per tier, on the KDS canvas.
 *
 * Age is the only thing on a row allowed to carry colour, and it carries it in
 * exactly two places: the spine and the timer. Everything else stays quiet.
 */
export const AGE_TONES: Record<AgeTier, { spine: string; text: string }> = {
  fresh: { spine: "bg-kds-text-secondary", text: "text-kds-text-primary" },
  warm: { spine: "bg-accent-primary", text: "text-accent-primary" },
  late: { spine: "bg-badge-alert", text: "text-badge-alert" },
};
