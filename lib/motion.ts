import type { Transition } from "framer-motion";

/** Structural transitions: modals, drawers, layout morphs, shared elements. */
export const spring: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 1,
};

/** Press feedback on buttons and cards. */
export const pressSpring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
};

/** Vertical slide + fade used for dynamic numbers (price, stock, cart count). */
export const numberTransition = {
  initial: { y: -10, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 10, opacity: 0 },
} as const;
