import type { Transition, Variants } from "framer-motion";

export const glide: Transition = { duration: 0.8, ease: [0.16, 1, 0.3, 1] };

export const lineReveal: Variants = {
  hidden: { y: "110%" },
  visible: { y: "0%" },
};

export const rise: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const inView = { once: true, margin: "0px 0px -12% 0px" } as const;
