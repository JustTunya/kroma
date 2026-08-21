"use client";

import Image from "next/image";
import { motion } from "framer-motion";

import { ReorderButton } from "@/components/account/ReorderButton";
import { glide, inView, rise } from "@/lib/reveal";
import type { CartLine } from "@/lib/cart";

/**
 * The item you order twice, given the storefront's editorial row treatment —
 * thumbnail, serif name, spec line — because a name in mono is a receipt.
 * A single row, not the multi-item menu's hero-preview split: one item never
 * earns a 360px dedicated image column.
 */
export function UsualPanel({
  name,
  price,
  spec,
  imageUrl,
  soldOut,
  lines,
}: {
  name: string;
  price: number;
  spec: string[];
  imageUrl: string;
  soldOut: boolean;
  lines: CartLine[];
}) {
  return (
    <motion.section
      aria-label="Your usual"
      initial="hidden"
      whileInView="visible"
      viewport={inView}
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className="border-b border-hairline px-5 py-16 sm:px-10 lg:px-14 lg:py-24"
    >
      <motion.p
        variants={rise}
        transition={glide}
        className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase"
      >
        Your usual
      </motion.p>

      <motion.div
        variants={rise}
        transition={glide}
        className="mt-8 flex flex-wrap items-center gap-5 border-y border-hairline py-7 sm:flex-nowrap sm:gap-6 sm:py-9"
      >
        <div
          className={`relative size-20 shrink-0 overflow-hidden border border-border-subtle bg-surface-muted ${
            soldOut ? "grayscale" : ""
          }`}
        >
          <Image src={imageUrl} alt="" fill sizes="80px" className="object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <h2
            className={`font-serif text-[clamp(24px,2.6vw,34px)] leading-[1.05] tracking-[-0.02em] ${
              soldOut ? "text-text-tertiary" : "text-text-primary"
            }`}
          >
            {name}
          </h2>

          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
            {spec.map((part, index) => (
              <span key={part} className="flex items-center gap-3">
                {index > 0 && (
                  <span aria-hidden className="text-hairline">
                    /
                  </span>
                )}
                {part}
              </span>
            ))}
          </p>
        </div>

        <div className="flex w-full shrink-0 items-center justify-between gap-4 sm:w-auto sm:justify-end">
          <span
            className={`font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums ${
              soldOut ? "text-text-tertiary" : "text-text-primary"
            }`}
          >
            €{price.toFixed(2)}
          </span>
          <ReorderButton lines={lines} label="Order again" />
        </div>
      </motion.div>
    </motion.section>
  );
}
