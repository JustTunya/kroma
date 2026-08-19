"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type AccountNavItem = { href: string; label: string; badge?: string };

/**
 * A hairline rail on desktop, the CategoryNav pill rail below md. Both drive the
 * same active state off the pathname, so there is nothing to keep in sync.
 */
export function AccountNav({ items }: { items: AccountNavItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/account" ? pathname === "/account" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop rail */}
      <nav aria-label="Account" className="hidden md:block">
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex items-baseline justify-between gap-4 py-3 font-mono text-[11px]",
                  "font-medium tracking-[0.16em] uppercase transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                  isActive(item.href)
                    ? "text-text-primary"
                    : "text-text-tertiary hover:text-text-primary",
                )}
              >
                {item.label}
                {item.badge && (
                  <span className="font-mono text-[11px] tracking-[0.02em] tabular-nums text-text-tertiary">
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile pills */}
      <nav
        aria-label="Account"
        className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 md:hidden"
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
                isActive(item.href) ? "text-surface-canvas" : "text-text-tertiary",
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
    </>
  );
}
