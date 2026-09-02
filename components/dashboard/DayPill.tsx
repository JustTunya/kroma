"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The only place mid-service that answers "did anyone actually open?". Text and
 * not an icon, because the state matters more than the affordance.
 */
export function DayPill({ openedAt }: { openedAt: string | null }) {
  const clock = openedAt
    ? new Date(openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Link
      href="/dashboard/day"
      className={cn(
        "flex h-9 shrink-0 items-center rounded-full border px-4 font-mono text-[10px] font-medium tracking-[0.18em] uppercase transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
        clock
          ? "border-kds-border text-kds-text-secondary hover:border-kds-text-secondary hover:text-kds-text-primary"
          : "border-badge-alert text-badge-alert",
      )}
    >
      <span className="mr-[-0.18em]">
        {clock ? (
          <>
            Day
            <span aria-hidden className="mx-2.5 text-kds-border">/</span>
            <span className="tabular-nums">{clock}</span>
          </>
        ) : (
          "Closed"
        )}
      </span>
    </Link>
  );
}
