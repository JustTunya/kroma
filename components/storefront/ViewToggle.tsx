"use client";

import { motion } from "framer-motion";
import { LayoutGrid, List } from "lucide-react";

import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type MenuViewMode = "list" | "lookbook";

type ViewToggleProps = {
  mode: MenuViewMode;
  onChange: (mode: MenuViewMode) => void;
};

const OPTIONS: { mode: MenuViewMode; label: string; icon: typeof List }[] = [
  { mode: "list", label: "List", icon: List },
  { mode: "lookbook", label: "Lookbook", icon: LayoutGrid },
];

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Menu view"
      className="flex shrink-0 items-center gap-1 rounded-full border border-hairline bg-surface-canvas p-1"
    >
      {OPTIONS.map((option) => {
        const isActive = option.mode === mode;
        const Icon = option.icon;
        return (
          <motion.button
            key={option.mode}
            type="button"
            onClick={() => onChange(option.mode)}
            whileTap={{ scale: 0.98 }}
            transition={pressSpring}
            aria-pressed={isActive}
            aria-label={`${option.label} view`}
            className={cn(
              "relative flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-3 font-mono text-[10px] font-medium tracking-[0.14em] whitespace-nowrap uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
              isActive ? "text-surface-canvas" : "text-text-tertiary",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="activeViewToggle"
                transition={spring}
                className="absolute inset-0 rounded-full bg-text-primary"
                aria-hidden
              />
            )}
            <Icon aria-hidden size={13} strokeWidth={2} className="relative" />
            <span className="relative hidden sm:inline">{option.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
