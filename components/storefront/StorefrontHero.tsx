"use client";

import { motion, useReducedMotion } from "framer-motion";

import { HeroParallax } from "@/components/storefront/HeroParallax";
import { glide, lineReveal } from "@/lib/reveal";

function Line({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <span className="block overflow-hidden pb-[0.18em]">
      <motion.span
        className="block"
        variants={lineReveal}
        transition={{ ...glide, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export function StorefrontHero() {
  const reduced = useReducedMotion();

  return (
    <section className="relative flex h-dvh w-full items-end overflow-hidden bg-text-primary">
      <HeroParallax />

      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-text-primary/95 via-text-primary/45 to-text-primary/5"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-r from-text-primary/80 via-text-primary/25 to-transparent"
      />

      <motion.div
        initial={reduced ? false : "hidden"}
        animate="visible"
        variants={{ hidden: {}, visible: {} }}
        className="relative w-full px-5 pb-12 sm:px-10 sm:pb-16 lg:px-14"
      >
        <motion.p
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          transition={{ ...glide, delay: 0.1 }}
          className="font-mono text-[11px] font-semibold tracking-[0.18em] text-surface-canvas/70 uppercase"
        >
          Cluj-Napoca — Specialty roastery &amp; micro-bakehouse
        </motion.p>

        <h1 className="mt-5 max-w-[16ch] font-serif text-[clamp(56px,10vw,148px)] leading-[0.92] tracking-[-0.03em] text-surface-canvas">
          <Line delay={0.2}>Light roasts,</Line>
          <Line delay={0.32}>
            long <em className="italic">ferments.</em>
          </Line>
        </h1>

        <motion.p
          variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
          transition={{ ...glide, delay: 0.5 }}
          className="mt-7 max-w-md font-mono text-[13px] leading-[1.7] tracking-[0.02em] text-surface-canvas/75"
        >
          Roasted Tuesday. Baked this morning. Collected at the bar.
        </motion.p>
      </motion.div>
    </section>
  );
}
