"use client";

import { motion } from "framer-motion";

import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

type CategoryNavProps = {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
};

export function CategoryNav({ categories, active, onSelect }: CategoryNavProps) {
  return (
    <nav
      aria-label="Menu categories"
      className="sticky top-16 z-40 border-b border-hairline bg-surface-canvas/85 backdrop-blur-xl"
    >
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex w-max gap-1.5 px-5 py-3 sm:px-10 lg:px-14">
          {categories.map((category) => {
            const isActive = category === active;

            return (
              <motion.button
                key={category}
                type="button"
                onClick={() => onSelect(category)}
                whileTap={{ scale: 0.98 }}
                transition={pressSpring}
                aria-pressed={isActive}
                className={cn(
                  "relative flex h-9 shrink-0 items-center rounded-full px-4 font-mono text-[10px] font-medium tracking-[0.16em] whitespace-nowrap uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                  isActive ? "text-surface-canvas" : "text-text-tertiary",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeCategory"
                    transition={spring}
                    className="absolute inset-0 rounded-full bg-text-primary"
                    aria-hidden
                  />
                )}
                <span className="relative">{category}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
