"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { QtyStepper } from "@/components/storefront/QtyStepper";
import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { CartLine } from "@/lib/cart";
import type { MenuItem } from "@/types/menu";

type ModifierSheetProps = {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
};

export function ModifierSheet({ item, onClose, onAdd }: ModifierSheetProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!item) return;
    setSelections(
      Object.fromEntries(
        item.modifiers.map((group) => [group.name, group.options[0]?.name ?? ""]),
      ),
    );
    setQuantity(1);
  }, [item]);

  if (!item) return null;

  const selectedModifiers = item.modifiers.map((group) => {
    const optionName = selections[group.name];
    const option = group.options.find((candidate) => candidate.name === optionName);
    return { group: group.name, option: option?.name ?? "", priceOffset: option?.priceOffset ?? 0 };
  });

  const total =
    (item.base_price + selectedModifiers.reduce((sum, m) => sum + m.priceOffset, 0)) * quantity;

  function handleAdd() {
    if (!item) return;
    onAdd({
      id: crypto.randomUUID(),
      menuItemId: item.id,
      name: item.name,
      basePrice: item.base_price,
      quantity,
      selectedModifiers,
      imageUrl: item.image_url,
    });
    onClose();
  }

  return (
    <AnimatePresence>
      {item && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
            className="absolute inset-0 bg-text-primary/40 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Customize ${item.name}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={spring}
            className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-xl bg-surface-card sm:m-6 sm:max-w-md sm:rounded-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-hairline p-6">
              <div className="flex items-center gap-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-sm bg-surface-muted">
                  <Image src={item.image_url} alt="" fill sizes="64px" className="object-cover" />
                </div>
                <div>
                  <h2 className="font-serif text-[28px] leading-[1.05] tracking-[-0.02em] text-text-primary">
                    {item.name}
                  </h2>
                  <p className="mt-1 font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums text-text-secondary">
                    €{item.base_price.toFixed(2)}
                  </p>
                </div>
              </div>

              <motion.button
                type="button"
                onClick={onClose}
                whileTap={{ scale: 0.98 }}
                transition={pressSpring}
                aria-label="Close"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                <X aria-hidden size={16} strokeWidth={2} />
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {item.modifiers.map((group) => (
                <fieldset key={group.name} className="mb-8 last:mb-0">
                  <legend className="mb-3 font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
                    {group.name}
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {group.options.map((option) => {
                      const isActive = selections[group.name] === option.name;
                      return (
                        <motion.button
                          key={option.name}
                          type="button"
                          onClick={() =>
                            setSelections((prev) => ({ ...prev, [group.name]: option.name }))
                          }
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
                              layoutId={`modifier-${group.name}`}
                              transition={spring}
                              className="absolute inset-0 rounded-full bg-text-primary"
                              aria-hidden
                            />
                          )}
                          <span className="relative">
                            {option.name}
                            {option.priceOffset > 0 && ` +€${option.priceOffset.toFixed(2)}`}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-hairline p-6">
              <QtyStepper quantity={quantity} onChange={setQuantity} label={item.name} />

              <motion.button
                type="button"
                onClick={handleAdd}
                whileTap={{ scale: 0.98 }}
                transition={pressSpring}
                aria-label={`Add ${item.name} to order, €${total.toFixed(2)}`}
                className="flex h-10 items-center rounded-full bg-accent-primary px-5 font-mono text-[11px] font-medium tracking-[0.14em] whitespace-nowrap text-surface-card uppercase transition-colors duration-300 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                Add to order — €{total.toFixed(2)}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
