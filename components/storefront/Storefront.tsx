"use client";

import { useMemo, useState } from "react";

import { CartDrawer } from "@/components/storefront/CartDrawer";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { CraftNotes } from "@/components/storefront/CraftNotes";
import { DayLedger } from "@/components/storefront/DayLedger";
import { MenuList } from "@/components/storefront/MenuList";
import { ModifierSheet } from "@/components/storefront/ModifierSheet";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontHero } from "@/components/storefront/StorefrontHero";
import { useCart } from "@/lib/use-cart";
import type { MenuItem } from "@/types/menu";

const ALL = "All";

export function Storefront({
  items,
  signedIn,
  serviceOpen,
}: {
  items: MenuItem[];
  signedIn: boolean;
  serviceOpen: boolean;
}) {
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [cartOpen, setCartOpen] = useState(false);
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const cart = useCart(signedIn);

  function handleAdd(item: MenuItem) {
    if (item.modifiers.length > 0) {
      setCustomizing(item);
      return;
    }
    cart.add({
      id: crypto.randomUUID(),
      menuItemId: item.id,
      name: item.name,
      basePrice: item.base_price,
      quantity: 1,
      selectedModifiers: [],
      imageUrl: item.image_url,
      vatRate: item.vat_rate,
    });
  }

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
      <StorefrontHeader
        cartCount={cart.count}
        signedIn={signedIn}
        onCartOpen={() => setCartOpen(true)}
      />
      <main className="flex-1">
        <StorefrontHero />
        {}
        <DayLedger items={items} serviceOpen={serviceOpen} />
        {}
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
            <MenuList items={visibleItems} onAdd={handleAdd} />
          </section>
        </div>
        <CraftNotes />
      </main>
      <SiteFooter />

      <ModifierSheet
        item={customizing}
        onClose={() => setCustomizing(null)}
        onAdd={(line) => cart.add(line)}
      />
      <CartDrawer
        open={cartOpen}
        lines={cart.lines}
        onClose={() => setCartOpen(false)}
        onQuantityChange={cart.setQuantity}
        onRemove={cart.remove}
        serviceOpen={serviceOpen}
      />
    </>
  );
}
