"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { glide, inView, rise } from "@/lib/reveal";

/**
 * The owner-curated "this week" teaser — a reason to open the account page
 * beyond reordering the usual. Points at the storefront rather than adding to
 * cart directly: a featured item can carry required modifiers the account
 * page has no picker for.
 */
export function WeeklyDrop({
  name,
  description,
  price,
  spec,
  imageUrl,
}: {
  name: string;
  description: string | null;
  price: number;
  spec: string[];
  imageUrl: string;
}) {
  return (
    <motion.section
      aria-label="This week"
      initial="hidden"
      whileInView="visible"
      viewport={inView}
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className="border-b border-hairline px-5 py-16 sm:px-10 lg:px-14 lg:py-24"
    >
      <motion.p
        variants={rise}
        transition={glide}
        className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase"
      >
        This week
      </motion.p>

      <motion.div
        variants={rise}
        transition={glide}
        className="mt-8 flex flex-wrap items-center gap-5 border-y border-hairline py-7 sm:flex-nowrap sm:gap-6 sm:py-9"
      >
        <div className="relative size-20 shrink-0 overflow-hidden border border-border-subtle bg-surface-muted">
          <Image src={imageUrl} alt="" fill sizes="80px" className="object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-[clamp(24px,2.6vw,34px)] leading-[1.05] tracking-[-0.02em] text-text-primary">
            {name}
          </h2>

          {description && (
            <p className="mt-2.5 max-w-md text-[15px] leading-[1.6] text-text-secondary">
              {description}
            </p>
          )}

          {spec.length > 0 && (
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
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
          )}
        </div>

        <div className="flex w-full shrink-0 items-center justify-between gap-4 sm:w-auto sm:justify-end">
          <span className="font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums text-text-primary">
            €{price.toFixed(2)}
          </span>
          <Link
            href="/"
            className="flex h-10 items-center rounded-full bg-accent-primary px-5 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-surface-card transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >
            See it on the menu
          </Link>
        </div>
      </motion.div>
    </motion.section>
  );
}
