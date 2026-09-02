"use client";

import { motion } from "framer-motion";

import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function LaneRail({
  lanes,
  active,
  onSelect,
}: {
  lanes: { title: string; count: number }[];
  active: string;
  onSelect: (title: string) => void;
}) {
  return (
    <nav
      aria-label="Lane"
      className="scrollbar-hide flex gap-2 overflow-x-auto py-4 lg:hidden"
    >
      {lanes.map((lane) => {
        const isActive = lane.title === active;

        return (
          <motion.div
            key={lane.title}
            className="shrink-0"
            whileTap={{ scale: 0.98 }}
            transition={pressSpring}
          >
            <button
              type="button"
              onClick={() => onSelect(lane.title)}
              aria-pressed={isActive}
              className={cn(
                "relative flex h-9 items-center gap-2 rounded-full px-4 font-mono text-[10px]",
                "font-medium tracking-[0.16em] uppercase transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
                isActive
                  ? "text-kds-canvas"
                  : "text-kds-text-secondary hover:text-kds-text-primary",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="activeLane"
                  transition={spring}
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-kds-text-primary"
                />
              )}
              <span className="relative">{lane.title}</span>
              <span className="relative tabular-nums">{lane.count}</span>
            </button>
          </motion.div>
        );
      })}
    </nav>
  );
}
