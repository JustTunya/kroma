"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type AccountNavItem = { href: string; label: string; badge?: string };

/**
 * The storefront's category rail, pointed at the account. One pill row at every
 * breakpoint — four destinations never earned a sidebar, and the rail parks in
 * the same sticky slot CategoryNav does so both pages feel like one building.
 */
export function AccountNav({ items }: { items: AccountNavItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/account" ? pathname === "/account" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Account"
      /* No negative gutters: the rail already sits inside the page gutter, and a
         negative right margin would run the pills under the sign-out button. */
      className="scrollbar-hide flex gap-2 overflow-x-auto"
    >
      {items.map((item) => (
        <motion.div
          key={item.href}
          className="shrink-0"
          whileTap={{ scale: 0.98 }}
          transition={pressSpring}
        >
          <Link
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "relative flex h-9 items-center gap-2 rounded-full px-4 font-mono text-[10px]",
              "font-medium tracking-[0.16em] uppercase transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
              isActive(item.href)
                ? "text-surface-canvas"
                : "text-text-tertiary hover:text-text-primary",
            )}
          >
            {isActive(item.href) && (
              <motion.span
                layoutId="activeAccountNav"
                transition={spring}
                aria-hidden
                className="absolute inset-0 rounded-full bg-text-primary"
              />
            )}
            <span className="relative">{item.label}</span>
            {item.badge && (
              <span className="relative font-mono text-[10px] tracking-[0.02em] tabular-nums">
                {item.badge}
              </span>
            )}
          </Link>
        </motion.div>
      ))}
    </nav>
  );
}
