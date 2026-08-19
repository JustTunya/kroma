"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

import { MenuRow } from "@/components/storefront/MenuRow";
import { glide } from "@/lib/reveal";
import type { MenuItem } from "@/types/menu";

type MenuListProps = {
  items: MenuItem[];
  onAdd: (item: MenuItem) => void;
};

export function MenuList({ items, onAdd }: MenuListProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="border-y border-hairline py-10 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
        Nothing on the pass in this section today.
      </p>
    );
  }

  const preview = items.find((item) => item.id === previewId) ?? items[0];

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20">
      <ul className="divide-y divide-hairline border-y border-hairline">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item) => (
            <MenuRow
              key={item.id}
              item={item}
              onAdd={onAdd}
              onPreview={(next) => setPreviewId(next.id)}
            />
          ))}
        </AnimatePresence>
      </ul>

      <div aria-hidden className="hidden lg:block">
        <div className="sticky top-32">
          <div className="relative aspect-4/5 w-full overflow-hidden border border-border-subtle bg-surface-muted shadow-card">
            <AnimatePresence initial={false}>
              <motion.div
                key={preview.id}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={glide}
                className="absolute inset-0"
              >
                <Image
                  src={preview.image_url}
                  alt={preview.name}
                  fill
                  sizes="360px"
                  className="object-cover"
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <p className="mt-4 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
            {preview.name}
            {preview.origin && ` / ${preview.origin}`}
          </p>
        </div>
      </div>
    </div>
  );
}
