import type { Transition, Variants } from "framer-motion";

/**
 * Entrance choreography.
 *
 * Springs (lib/motion.ts) drive structure — things the user pushed. Entrances
 * are uninterrupted arrivals, so they glide on a long ease-out instead.
 */
export const glide: Transition = { duration: 0.8, ease: [0.16, 1, 0.3, 1] };

/** A display line sliding up from behind its own overflow clip. */
export const lineReveal: Variants = {
  hidden: { y: "110%" },
  visible: { y: "0%" },
};

/** Content rising as it arrives. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

/** Shared whileInView config: play once, a little before the block is fully in. */
export const inView = { once: true, margin: "0px 0px -12% 0px" } as const;
