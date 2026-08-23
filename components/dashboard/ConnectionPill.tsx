"use client";

import { motion, useReducedMotion } from "framer-motion";

import { useBoardStatus } from "@/components/dashboard/BoardStatus";
import { cn } from "@/lib/utils";

export function ConnectionPill() {
  const reduced = useReducedMotion();
  const { connection, freshAt } = useBoardStatus();

  if (!connection) return null;

  const label =
    connection === "live"
      ? "Live"
      : connection === "reconnecting"
        ? "Reconnecting"
        : `Offline — ${freshAt.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}`;

  const tone =
    connection === "live"
      ? "text-badge-live"
      : connection === "reconnecting"
        ? "text-accent-primary"
        : "text-badge-alert";

  return (
    <p
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 font-mono text-[10px] font-medium leading-none uppercase",
        tone,
      )}
    >
      <motion.span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-current mb-0.5"
        animate={
          reduced || connection !== "live" ? undefined : { opacity: [1, 0.25, 1] }
        }
        transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
      />
      {label}
    </p>
  );
}
