"use client";

import Image from "next/image";
import { motion } from "framer-motion";

import { ReorderButton } from "@/components/account/ReorderButton";
import { glide, inView, rise } from "@/lib/reveal";
import type { CartLine } from "@/lib/cart";

/**
 * The item you order twice, given the storefront's editorial row treatment —
 * photograph, serif name, spec line — because a name in mono is a receipt and
 * a photograph is an invitation.
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

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20">
        <div className="flex items-start gap-4 sm:gap-6">
          <motion.div
            variants={rise}
            transition={glide}
            className={`relative size-20 shrink-0 overflow-hidden rounded-sm bg-surface-muted lg:hidden ${
              soldOut ? "grayscale" : ""
            }`}
          >
            <Image src={imageUrl} alt="" fill sizes="80px" className="object-cover" />
          </motion.div>

          <div className="min-w-0 flex-1">
            <motion.div
              variants={rise}
              transition={glide}
              className="flex items-baseline justify-between gap-5"
            >
              <h2
                className={`font-serif text-[clamp(28px,3.2vw,44px)] leading-[1.05] tracking-[-0.02em] ${
                  soldOut ? "text-text-tertiary" : "text-text-primary"
                }`}
              >
                {name}
              </h2>
              <span
                className={`shrink-0 font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums ${
                  soldOut ? "text-text-tertiary" : "text-text-primary"
                }`}
              >
                €{price.toFixed(2)}
              </span>
            </motion.div>

            <motion.p
              variants={rise}
              transition={glide}
              className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase"
            >
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
            </motion.p>

            <motion.div variants={rise} transition={glide} className="mt-8">
              <ReorderButton lines={lines} label="Order again" />
            </motion.div>
          </div>
        </div>

        <motion.div
          variants={rise}
          transition={glide}
          className={`relative hidden aspect-4/5 overflow-hidden rounded-lg border border-border-subtle bg-surface-muted shadow-card lg:block ${
            soldOut ? "grayscale" : ""
          }`}
        >
          <Image src={imageUrl} alt="" fill sizes="360px" className="object-cover" />
        </motion.div>
      </div>
    </motion.section>
  );
}
