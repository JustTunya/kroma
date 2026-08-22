"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { lockAction } from "@/app/dashboard/actions";
import { ConnectionPill } from "@/components/dashboard/ConnectionPill";
import { pressSpring } from "@/lib/motion";

/**
 * Who is unlocked, where, and whether the board is still hearing from the
 * server. Fixed at h-14 — one line shorter than the storefront header, because
 * a bar screen owes every pixel it can to the orders.
 */
export function StaffBar({
  stationName,
  actorName,
}: {
  stationName: string;
  actorName: string | null;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-4 border-b border-kds-border bg-kds-canvas px-5 sm:px-10 lg:px-14">
      <Link
        href="/dashboard/board"
        className="flex min-w-0 items-baseline gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kds-text-primary"
      >
        <span className="font-serif text-[22px] leading-none tracking-[-0.02em]">
          KROMA
        </span>
        <span className="truncate font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
          {stationName}
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-4">
        <ConnectionPill />

        {actorName ? (
          <form action={lockAction}>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.98 }}
              transition={pressSpring}
              className="flex h-9 items-center rounded-full border border-kds-border px-4 font-mono text-[10px] font-medium tracking-[0.18em] uppercase transition-colors hover:border-kds-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              {actorName}
              <span aria-hidden className="mx-2.5 text-kds-border">
                /
              </span>
              <span className="text-kds-text-secondary">Hand over</span>
            </motion.button>
          </form>
        ) : (
          <motion.div whileTap={{ scale: 0.98 }} transition={pressSpring}>
            <Link
              href="/dashboard/unlock"
              className="flex h-9 items-center rounded-full bg-accent-primary px-4 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              Unlock
            </Link>
          </motion.div>
        )}
      </div>
    </header>
  );
}
