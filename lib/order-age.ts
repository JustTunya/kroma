
export type AgeTier = "fresh" | "warm" | "late";

const WARM_MS = 5 * 60_000;
const LATE_MS = 10 * 60_000;

export function ageTier(since: Date, now: Date = new Date()): AgeTier {
  const elapsed = now.getTime() - since.getTime();
  if (elapsed >= LATE_MS) return "late";
  if (elapsed >= WARM_MS) return "warm";
  return "fresh";
}

export function ageFraction(since: Date, now: Date = new Date()): number {
  return Math.min(1, Math.max(0, (now.getTime() - since.getTime()) / LATE_MS));
}

const STALE_MS = 30 * 60_000;

export function isStale(since: Date, now: Date = new Date()): boolean {
  return now.getTime() - since.getTime() >= STALE_MS;
}

export function elapsedLabel(since: Date, now: Date = new Date()): string {
  const total = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 1000));
  const minutes = Math.floor(total / 60);

  if (minutes < 60) return `${minutes}:${String(total % 60).padStart(2, "0")}`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h${String(minutes % 60).padStart(2, "0")}`;
}

export const AGE_TONES: Record<AgeTier, { spine: string; text: string }> = {
  fresh: { spine: "bg-kds-text-secondary", text: "text-kds-text-primary" },
  warm: { spine: "bg-accent-primary", text: "text-accent-primary" },
  late: { spine: "bg-badge-alert", text: "text-badge-alert" },
};
