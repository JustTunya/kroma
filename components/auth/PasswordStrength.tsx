"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { numberTransition, spring } from "@/lib/motion";
import { PASSWORD_RULES, strengthLabel } from "@/lib/password";
import { cn } from "@/lib/utils";

const met = (value: string) => PASSWORD_RULES.map((rule) => rule.test(value));

export function PasswordStrengthLabel({ value }: { value: string }) {
  const reduce = useReducedMotion();
  const score = met(value).filter(Boolean).length;
  const label = strengthLabel(score);

  return (
    <span role="status" className="font-mono text-[10px] font-medium tracking-[0.14em] uppercase">
      <AnimatePresence mode="popLayout" initial={false}>
        {value && (
          <motion.span
            key={label}
            {...(reduce ? {} : numberTransition)}
            transition={spring}
            className={cn(
              "block",
              score === PASSWORD_RULES.length ? "text-badge-live" : "text-text-tertiary",
            )}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export function PasswordStrength({ id, value }: { id: string; value: string }) {
  const reduce = useReducedMotion();
  const state = met(value);
  const full = state.every(Boolean);

  return (
    <ul id={id} className="grid grid-cols-5 gap-x-1.5 gap-y-3 sm:gap-x-2">
      {PASSWORD_RULES.map((rule, index) => (
        <li
          key={rule.id}
          className={cn(
            "grid gap-1.5 transition-colors duration-300",
            !state[index]
              ? "text-text-tertiary"
              : full
                ? "text-badge-live"
                : "text-accent-primary",
          )}
        >
          <span aria-hidden className="h-0.5 overflow-hidden bg-hairline">
            <motion.span
              initial={false}
              animate={{ scaleX: state[index] ? 1 : 0 }}
              transition={reduce ? { duration: 0 } : spring}
              className="block h-full w-full origin-left bg-current"
            />
          </span>

          <span className="font-mono text-[9px] font-medium tracking-[0.08em] uppercase sm:text-[10px] sm:tracking-[0.14em]">
            {rule.label}
            <span className="sr-only">{state[index] ? "— met" : "— missing"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
