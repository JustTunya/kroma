import type { Transition } from "framer-motion";

export const spring: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 1,
};

export const pressSpring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
};

export const numberTransition = {
  initial: { y: -10, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 10, opacity: 0 },
} as const;
