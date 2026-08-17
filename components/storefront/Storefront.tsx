"use client";

import { useMemo, useState } from "react";

import { CategoryNav } from "@/components/storefront/CategoryNav";
import { CraftNotes } from "@/components/storefront/CraftNotes";
import { DayLedger } from "@/components/storefront/DayLedger";
import { MenuList } from "@/components/storefront/MenuList";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontHero } from "@/components/storefront/StorefrontHero";
import type { MenuItem } from "@/types/menu";

const ALL = "All";

export function Storefront({ items }: { items: MenuItem[] }) {
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [cartCount, setCartCount] = useState(0);

  const categories = useMemo(
    () => [ALL, ...new Set(items.map((item) => item.category))],
    [items],
  );

  const visibleItems = useMemo(
    () =>
      activeCategory === ALL
        ? items
        : items.filter((item) => item.category === activeCategory),
    [items, activeCategory],
  );

  return (
    <>
      <StorefrontHeader cartCount={cartCount} />
      <main className="flex-1">
        <StorefrontHero />
        {/* The ledger reads the whole day, not the filtered view. */}
        <DayLedger items={items} />
        {/* The rail sticks for as long as there is menu under it, and no longer. */}
        <div>
          <CategoryNav
            categories={categories}
            active={activeCategory}
            onSelect={setActiveCategory}
          />
          <section
            aria-label="Menu"
            className="px-5 pt-12 pb-24 sm:px-10 lg:px-14 lg:pt-20 lg:pb-32"
          >
            {/* ponytail: cart is a counter until the customizer sheet lands —
                swap setCartCount for the real cart store, props stay the same. */}
            <MenuList
              items={visibleItems}
              onAdd={() => setCartCount((n) => n + 1)}
            />
          </section>
        </div>
        <CraftNotes />
      </main>
      <SiteFooter />
    </>
  );
}
