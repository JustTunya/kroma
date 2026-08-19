"use client";

import { motion, useReducedMotion } from "framer-motion";

import { glide, lineReveal } from "@/lib/reveal";

function Line({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <span className="block overflow-hidden pb-[0.18em]">
      <motion.span className="block" variants={lineReveal} transition={{ ...glide, delay }}>
        {children}
      </motion.span>
    </span>
  );
}

export function AuthHeroCopy() {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : "hidden"}
      animate="visible"
      variants={{ hidden: {}, visible: {} }}
      className="relative px-14 pb-14"
    >
      <motion.p
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        transition={{ ...glide, delay: 0.1 }}
        className="font-mono text-[11px] font-semibold tracking-[0.18em] text-surface-canvas/70 uppercase"
      >
        Cluj-Napoca — Specialty roastery &amp; micro-bakehouse
      </motion.p>

      <p className="mt-5 max-w-[14ch] font-serif text-[clamp(32px,3.4vw,52px)] leading-[1.05] tracking-[-0.02em] text-surface-canvas">
        <Line delay={0.2}>Order ahead,</Line>
        <Line delay={0.32}>
          <em className="italic">collect</em> at the bar.
        </Line>
      </p>

      <motion.p
        variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
        transition={{ ...glide, delay: 0.5 }}
        className="mt-7 max-w-120 font-mono text-[13px] leading-[1.7] tracking-[0.02em] text-surface-canvas/75"
      >
        Roasted Tuesday. Baked this morning. Held under your name.
      </motion.p>
    </motion.div>
  );
}
