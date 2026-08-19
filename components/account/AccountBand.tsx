"use client";

import { motion, useReducedMotion } from "framer-motion";

import { PunchCard } from "@/components/account/PunchCard";
import { glide, lineReveal } from "@/lib/reveal";

/** A display line arriving from behind its own clip, hero choreography. */
function Line({ delay, children }: { delay: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <span className="block overflow-hidden pb-[0.18em]">
      <motion.span
        className="block"
        variants={lineReveal}
        initial={reduced ? false : "hidden"}
        animate="visible"
        transition={{ ...glide, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/**
 * The account's one dark surface. It carries the greeting and the card, because
 * the card is the reason to come back and a section three scrolls down is not.
 */
export function AccountBand({
  greeting,
  name,
  punches,
  details,
}: {
  greeting: string;
  name: string;
  punches: number;
  details: string[];
}) {
  const reduced = useReducedMotion();

  return (
    <section
      aria-label="Your card"
      className="bg-text-primary px-5 pt-16 pb-14 text-surface-canvas sm:px-10 lg:px-14 lg:pt-24 lg:pb-20"
    >
      <div className="grid gap-12 lg:grid-cols-2 lg:items-end lg:gap-20">
        <h1 className="max-w-[14ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em]">
          <Line delay={0.1}>{greeting}</Line>
          <Line delay={0.22}>
            <em className="italic">{name}</em>.
          </Line>
        </h1>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...glide, delay: 0.4 }}
        >
          <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
            Your card
          </p>
          <div className="mt-6">
            <PunchCard punches={punches} size="lg" tone="dark" headline />
          </div>
        </motion.div>
      </div>

      <motion.p
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...glide, delay: 0.55 }}
        className="mt-12 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] font-medium tracking-[0.14em] text-kds-text-secondary uppercase lg:mt-16"
      >
        {details.map((detail, index) => (
          <span key={detail} className="flex items-center gap-3">
            {index > 0 && (
              <span aria-hidden className="text-kds-border">
                /
              </span>
            )}
            {detail}
          </span>
        ))}
      </motion.p>
    </section>
  );
}
