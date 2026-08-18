"use client";

import { useEffect, useMemo, useState } from "react";

import { CartDrawer } from "@/components/storefront/CartDrawer";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { CraftNotes } from "@/components/storefront/CraftNotes";
import { DayLedger } from "@/components/storefront/DayLedger";
import { MenuList } from "@/components/storefront/MenuList";
import { ModifierSheet } from "@/components/storefront/ModifierSheet";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontHero } from "@/components/storefront/StorefrontHero";
import {
  cartCount as countLines,
  clearGuestCart,
  mergeCarts,
  readGuestCart,
  writeGuestCart,
  type CartLine,
} from "@/lib/cart";
import { readServerCart, writeServerCart } from "@/lib/cart-sync";
import type { MenuItem } from "@/types/menu";

const ALL = "All";

export function Storefront({
  items,
  signedIn,
}: {
  items: MenuItem[];
  signedIn: boolean;
}) {
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);

  // ponytail: hydrate once on mount / sign-in change; no realtime cross-tab sync yet.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!signedIn) {
        if (!cancelled) setCart(readGuestCart());
        return;
      }

      const guestCart = readGuestCart();
      const serverCart = await readServerCart();
      const merged = guestCart.length ? mergeCarts(serverCart, guestCart) : serverCart;

      if (guestCart.length) {
        try {
          await writeServerCart(merged);
          clearGuestCart();
        } catch (error) {
          // Server write failed — keep the guest copy so nothing is lost.
          console.error("cart merge failed:", error);
        }
      }

      if (!cancelled) setCart(merged);
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  function persist(next: CartLine[]) {
    setCart(next);
    if (signedIn) {
      writeServerCart(next);
    } else {
      writeGuestCart(next);
    }
  }

  function handleAdd(item: MenuItem) {
    if (item.modifiers.length > 0) {
      setCustomizing(item);
      return;
    }
    persist(
      mergeCarts(cart, [
        {
          id: crypto.randomUUID(),
          menuItemId: item.id,
          name: item.name,
          basePrice: item.base_price,
          quantity: 1,
          selectedModifiers: [],
          imageUrl: item.image_url,
        },
      ]),
    );
  }

  function handleQuantityChange(lineId: string, quantity: number) {
    persist(cart.map((line) => (line.id === lineId ? { ...line, quantity } : line)));
  }

  function handleRemove(lineId: string) {
    persist(cart.filter((line) => line.id !== lineId));
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
        cartCount={countLines(cart)}
        signedIn={signedIn}
        onCartOpen={() => setCartOpen(true)}
      />
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
            <MenuList items={visibleItems} onAdd={handleAdd} />
          </section>
        </div>
        <CraftNotes />
      </main>
      <SiteFooter />

      <ModifierSheet
        item={customizing}
        onClose={() => setCustomizing(null)}
        onAdd={(line) => persist(mergeCarts(cart, [line]))}
      />
      <CartDrawer
        open={cartOpen}
        lines={cart}
        onClose={() => setCartOpen(false)}
        onQuantityChange={handleQuantityChange}
        onRemove={handleRemove}
      />
    </>
  );
}
