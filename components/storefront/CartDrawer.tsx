"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { QtyStepper } from "@/components/storefront/QtyStepper";
import { cartTotal, lineTotal, type CartLine } from "@/lib/cart";
import { pressSpring, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

type CartDrawerProps = {
  open: boolean;
  lines: CartLine[];
  onClose: () => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
};

export function CartDrawer({ open, lines, onClose, onQuantityChange, onRemove }: CartDrawerProps) {
  const total = cartTotal(lines);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
            className="absolute inset-0 bg-text-primary/25 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Your order"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={spring}
            className="relative flex h-full w-full max-w-full flex-col overflow-hidden bg-surface-card sm:w-105"
          >
            <div className="flex items-center justify-between gap-4 border-b border-hairline p-6">
              <h2 className="font-serif text-[28px] leading-[1.05] tracking-[-0.02em] text-text-primary">
                Your order
              </h2>
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={{ scale: 0.98 }}
                transition={pressSpring}
                aria-label="Close order"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                <X aria-hidden size={16} strokeWidth={2} />
              </motion.button>
            </div>

            {lines.length === 0 ? (
              <p className="border-y border-hairline p-6 py-10 font-mono text-[13px] tracking-[0.02em] text-text-secondary">
                Nothing on the counter yet.
              </p>
            ) : (
              <ul className="flex-1 divide-y divide-hairline overflow-y-auto px-6">
                <AnimatePresence mode="popLayout" initial={false}>
                  {lines.map((line) => (
                    <motion.li
                      key={line.id}
                      layout="position"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.12, ease: "easeOut" } }}
                      className="flex gap-4 py-6"
                    >
                      <div className="relative size-16 shrink-0 overflow-hidden bg-surface-muted">
                        <Image
                          src={line.imageUrl}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="truncate font-serif text-[20px] leading-[1.05] tracking-[-0.02em] text-text-primary">
                            {line.name}
                          </h3>
                          <span className="shrink-0 font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums text-text-primary">
                            €{lineTotal(line).toFixed(2)}
                          </span>
                        </div>

                        {line.selectedModifiers.length > 0 && (
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
                            {line.selectedModifiers.map((modifier, index) => (
                              <span key={modifier.group} className="flex items-center gap-3">
                                {index > 0 && (
                                  <span aria-hidden className="text-hairline">
                                    /
                                  </span>
                                )}
                                {modifier.option}
                              </span>
                            ))}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-between">
                          <QtyStepper
                            quantity={line.quantity}
                            onChange={(next) => onQuantityChange(line.id, next)}
                            label={line.name}
                          />
                          <button
                            type="button"
                            onClick={() => onRemove(line.id)}
                            aria-label={`Remove ${line.name} from order`}
                            className="font-mono text-[10px] font-medium tracking-[0.16em] text-text-tertiary uppercase transition-colors duration-300 hover:text-badge-alert focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}

            <div className="border-t border-hairline p-6">
              <div className="mb-4 flex items-baseline justify-between font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums text-text-primary">
                <span className="text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
                  Subtotal
                </span>
                €{total.toFixed(2)}
              </div>
              <Link
                href="/checkout"
                onClick={onClose}
                aria-disabled={lines.length === 0}
                aria-label={
                  lines.length === 0
                    ? "Checkout — nothing on the pass"
                    : `Checkout, €${total.toFixed(2)}`
                }
                className={cn(
                  "flex h-10 w-full items-center justify-center rounded-full font-mono text-[11px] font-medium tracking-[0.14em] uppercase transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                  lines.length === 0
                    ? "pointer-events-none bg-surface-muted text-text-tertiary"
                    : "bg-accent-primary text-surface-card hover:bg-accent-hover",
                )}
              >
                Checkout
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
