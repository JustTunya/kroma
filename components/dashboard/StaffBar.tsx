"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ChartNoAxesColumn } from "lucide-react";

import { endShiftAction, lockAction } from "@/app/dashboard/actions";
import { ConnectionPill } from "@/components/dashboard/ConnectionPill";
import { DayPill } from "@/components/dashboard/DayPill";
import { pressSpring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Who is unlocked, whether their shift is still open, and whether the board is
 * still hearing from the server. Fixed at h-14 — one line shorter than the storefront header, because
 * a bar screen owes every pixel it can to the orders.
 */
export function StaffBar({
  actorName,
  onShift,
  canSeeNumbers,
  dayOpenedAt,
}: {
  actorName: string | null;
  /** Whether this person has an open shift — the only state End can end. */
  onShift: boolean;
  /** Manager and owner only. The page redirects too; this hides the door. */
  canSeeNumbers: boolean;
  /** null when the shop has not opened today — the pill reads Closed. */
  dayOpenedAt: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-2 border-b border-kds-border bg-kds-canvas px-4 sm:gap-4 sm:px-10 lg:px-14">
      <Link
        href="/dashboard/board"
        className="flex min-w-0 shrink-0 items-baseline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kds-text-primary"
      >
        <span className="font-serif text-[22px] leading-none tracking-[-0.02em]">
          KROMA
        </span>
      </Link>

      <div className="flex min-w-0 shrink items-center gap-2 overflow-x-auto scrollbar-hide sm:gap-4">
        {error && (
          <span
            role="status"
            className="hidden font-mono text-[10px] font-medium tracking-[0.18em] text-badge-alert uppercase sm:block"
          >
            {error}
          </span>
        )}

        <div className="shrink-0">
          <ConnectionPill />
        </div>

        <div className="shrink-0">
          <DayPill openedAt={dayOpenedAt} />
        </div>

        {actorName && onShift && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            transition={pressSpring}
            onClick={async () => {
              setError(null);
              const result = await endShiftAction();
              if (!result.ok) setError(result.error ?? "That did not go through.");
            }}
            className="flex h-9 shrink-0 items-center justify-center rounded-full border border-kds-border px-4 font-mono text-[10px] font-medium text-accent-primary uppercase transition-colors hover:border-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
          >
            <span className="mr-[-0.18em] tracking-[0.18em]">
              <span className="hidden sm:inline">End the shift</span>
              <span className="sm:hidden">End shift</span>
            </span>
          </motion.button>
        )}

        {actorName ? (
          <form action={lockAction}>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.98 }}
              transition={pressSpring}
              className="flex h-9 shrink-0 items-center rounded-full border border-kds-border px-4 font-mono text-[10px] font-medium uppercase transition-colors hover:border-kds-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              <span className="tracking-[0.18em]">{actorName}</span>
              <span className="hidden items-center sm:flex">
                <span aria-hidden className="mx-2.5 text-kds-border">
                  /
                </span>
                <span className="mr-[-0.18em] tracking-[0.18em] text-kds-text-secondary">
                  Hand over
                </span>
              </span>
            </motion.button>
          </form>
        ) : (
          <motion.div className="shrink-0" whileTap={{ scale: 0.98 }} transition={pressSpring}>
            <Link
              href="/dashboard/unlock"
              className="flex h-9 shrink-0 items-center justify-center rounded-full bg-accent-primary px-4 font-mono text-[10px] font-medium text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              <span className="mr-[-0.18em] tracking-[0.18em]">Unlock</span>
            </Link>
          </motion.div>
        )}

        {canSeeNumbers && (
          <motion.div className="shrink-0" whileTap={{ scale: 0.98 }} transition={pressSpring}>
            <Link
              href="/dashboard/numbers"
              aria-label="The numbers — takings, shifts and the ledger"
              aria-current={pathname === "/dashboard/numbers" ? "page" : undefined}
              className={cn(
                "flex size-9 items-center justify-center rounded-full border transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
                pathname === "/dashboard/numbers"
                  ? "border-kds-text-primary bg-kds-text-primary text-kds-canvas"
                  : "border-kds-border text-kds-text-secondary hover:border-kds-text-secondary hover:text-kds-text-primary",
              )}
            >
              <ChartNoAxesColumn aria-hidden className="size-4" strokeWidth={1.75} />
            </Link>
          </motion.div>
        )}

      </div>
    </header>
  );
}
