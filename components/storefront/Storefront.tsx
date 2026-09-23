"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { CartDrawer } from "@/components/storefront/CartDrawer";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { CraftNotes } from "@/components/storefront/CraftNotes";
import { DayLedger } from "@/components/storefront/DayLedger";
import { ItemSpecimenDrawer } from "@/components/storefront/ItemSpecimenDrawer";
import { MenuList } from "@/components/storefront/MenuList";
import { MenuLookbook } from "@/components/storefront/MenuLookbook";
import { ModifierSheet } from "@/components/storefront/ModifierSheet";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontHero } from "@/components/storefront/StorefrontHero";
import type { MenuViewMode } from "@/components/storefront/ViewToggle";
import { glide } from "@/lib/reveal";
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
  const [viewMode, setViewMode] = useState<MenuViewMode>("list");
  const [cartOpen, setCartOpen] = useState(false);
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const [selectedSpecimen, setSelectedSpecimen] = useState<MenuItem | null>(null);
  const cart = useCart(signedIn);
  const reduced = useReducedMotion();

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
        <DayLedger items={items} serviceOpen={serviceOpen} />
        <div>
          <CategoryNav
            categories={categories}
            active={activeCategory}
            onSelect={setActiveCategory}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          <section
            aria-label="Menu"
            className="px-5 pt-12 pb-24 sm:px-10 lg:px-14 lg:pt-20 lg:pb-32"
          >
            <AnimatePresence mode="wait" initial={false}>
              {viewMode === "list" ? (
                <motion.div
                  key="view-list"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0 }}
                  transition={glide}
                >
                  <MenuList
                    items={visibleItems}
                    onAdd={handleAdd}
                    onOpenSpecimen={setSelectedSpecimen}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="view-lookbook"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0 }}
                  transition={glide}
                >
                  <MenuLookbook
                    items={visibleItems}
                    onAdd={handleAdd}
                    onOpenSpecimen={setSelectedSpecimen}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
        <CraftNotes />
      </main>
      <SiteFooter />

      <ItemSpecimenDrawer
        item={selectedSpecimen}
        onClose={() => setSelectedSpecimen(null)}
        onAdd={handleAdd}
        onCustomize={setCustomizing}
      />

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
