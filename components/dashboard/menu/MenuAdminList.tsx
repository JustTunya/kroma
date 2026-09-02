"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { reorderItemsAction } from "@/app/dashboard/menu/actions";
import { MenuItemSheet } from "@/components/dashboard/menu/MenuItemSheet";
import type { DraftItem } from "@/lib/menu-admin";
import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type Category = Database["public"]["Tables"]["menu_categories"]["Row"];
type Item = Database["public"]["Tables"]["menu_items"]["Row"];

function toDraft(item: Item): DraftItem {
  return {
    id: item.id,
    categoryId: item.category_id,
    name: item.name,
    slug: item.slug,
    description: item.description ?? "",
    basePrice: item.base_price,
    dailyStock: item.daily_stock,
    parStock: item.par_stock,
    dietaryTags: item.dietary_tags,
    allergens: item.allergens,
    modifiers: (item.modifiers as DraftItem["modifiers"]) ?? [],
    imageUrl: item.image_url,
    isActive: item.is_active,
  };
}

function emptyDraft(categoryId: string): DraftItem {
  return {
    id: null,
    categoryId,
    name: "",
    slug: "",
    description: "",
    basePrice: 0,
    dailyStock: null,
    parStock: null,
    dietaryTags: [],
    allergens: [],
    modifiers: [],
    imageUrl: null,
    isActive: true,
  };
}

export function MenuAdminList({
  categories,
  items,
}: {
  categories: Category[];
  items: Item[];
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [draft, setDraft] = useState<DraftItem | null>(null);
  // Bumped every open, so two "+ Item" drafts in a row remount the sheet
  // instead of one inheriting the other's half-typed fields — a plain
  // draft.id key can't tell two unsaved drafts apart, since both are null.
  const [draftKey, setDraftKey] = useState(0);

  const visible = useMemo(
    () => items.filter((item) => item.category_id === activeCategory),
    [items, activeCategory],
  );

  function move(item: Item, direction: -1 | 1) {
    const index = visible.findIndex((i) => i.id === item.id);
    const swapWith = visible[index + direction];
    if (!swapWith) return;

    const ids = [...visible];
    ids[index] = swapWith;
    ids[index + direction] = item;

    void reorderItemsAction(ids.map((i) => i.id)).then(() => router.refresh());
  }

  return (
    <>
      <nav aria-label="Menu categories" className="border-b border-kds-border">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex w-max items-center gap-1.5 px-5 py-3 sm:px-10 lg:px-14">
            {categories.map((category) => {
              const isActive = category.id === activeCategory;
              return (
                <motion.button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  whileTap={{ scale: 0.98 }}
                  transition={pressSpring}
                  aria-pressed={isActive}
                  className={cn(
                    "relative flex h-9 shrink-0 items-center rounded-full px-4 font-mono text-[10px] font-medium tracking-[0.16em] whitespace-nowrap uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
                    isActive ? "text-kds-canvas" : "text-kds-text-secondary",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeMenuCategory"
                      transition={spring}
                      className="absolute inset-0 rounded-full bg-kds-text-primary"
                      aria-hidden
                    />
                  )}
                  <span className="relative">{category.name}</span>
                </motion.button>
              );
            })}

            <button
              type="button"
              onClick={() => { setDraft(emptyDraft(activeCategory)); setDraftKey((k) => k + 1); }}
              className="flex h-9 shrink-0 items-center rounded-full border border-kds-border px-4 font-mono text-[10px] font-medium tracking-[0.16em] text-accent-primary uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              + Item
            </button>
          </div>
        </div>
      </nav>

      <ul className="mx-5 divide-y divide-kds-border border-y border-kds-border sm:mx-10 lg:mx-14">
        {visible.map((item, index) => {
          const lowStock =
            item.daily_stock !== null && item.daily_stock > 0 && item.daily_stock <= 5;

          const meta = [
            item.par_stock !== null ? `Par ${item.par_stock}` : "Unlimited",
            ...(lowStock ? [`${item.daily_stock} left`] : []),
            ...item.allergens.map((a) => a),
            ...(!item.is_active ? ["Off the menu"] : []),
          ];

          return (
            <li key={item.id} className="flex items-center gap-4 py-5">
              <button
                type="button"
                onClick={() => { setDraft(toDraft(item)); setDraftKey((k) => k + 1); }}
                className={cn(
                  "min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kds-text-primary",
                  !item.is_active && "text-kds-text-secondary",
                )}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate font-serif text-[clamp(20px,3vw,28px)] leading-[1.05] tracking-[-0.02em]">
                    {item.name}
                  </span>
                  <span className="shrink-0 font-mono text-[15px] font-medium tabular-nums">
                    €{item.base_price.toFixed(2)}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase">
                  {meta.map((part, i) => (
                    <span key={part}>
                      {i > 0 && (
                        <span aria-hidden className="mx-3 text-kds-border">
                          /
                        </span>
                      )}
                      {part}
                    </span>
                  ))}
                </p>
              </button>

              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => move(item, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${item.name} up`}
                  className="flex size-9 items-center justify-center rounded-full border border-kds-border text-kds-text-secondary transition-colors hover:border-kds-text-secondary hover:text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(item, 1)}
                  disabled={index === visible.length - 1}
                  aria-label={`Move ${item.name} down`}
                  className="flex size-9 items-center justify-center rounded-full border border-kds-border text-kds-text-secondary transition-colors hover:border-kds-text-secondary hover:text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:opacity-40"
                >
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <MenuItemSheet
        key={draftKey}
        draft={draft}
        categories={categories}
        onClose={() => setDraft(null)}
        onSaved={() => {
          setDraft(null);
          router.refresh();
        }}
      />
    </>
  );
}
