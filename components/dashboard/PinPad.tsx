"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Delete } from "lucide-react";

import { unlockAction } from "@/app/dashboard/actions";
import { pressSpring, spring } from "@/lib/motion";
import { ROLE_LABELS } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";

import type { StaffRole } from "@/lib/staff-permissions";

type RosterEntry = { id: string; display_name: string; role: StaffRole };

const PIN_LENGTH = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

/**
 * Pick a name, then type four digits.
 *
 * Two steps rather than a bare PIN: across a roster four digits collide, and
 * more importantly the person gets to see who the terminal thinks they are
 * before anything they do is attributed to that name.
 */
export function PinPad({ roster }: { roster: RosterEntry[] }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState<RosterEntry | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(staffId: string, value: string) {
    startTransition(async () => {
      const result = await unlockAction(staffId, value);
      if (result.ok) {
        router.push("/dashboard/board");
        router.refresh();
      } else {
        setPin("");
        setError(result.error ?? "That PIN is not right.");
      }
    });
  }

  function press(key: string) {
    if (pending) return;
    setError(null);

    if (key === "del") {
      setPin((current) => current.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;

    const next = pin + key;
    setPin(next);
    // Four digits is the whole PIN, so there is no reason to make anyone press
    // an extra confirm key with a tray in the other hand.
    if (next.length === PIN_LENGTH && picked) submit(picked.id, next);
  }

  function back() {
    setPicked(null);
    setPin("");
    setError(null);
  }

  // The physical keypad is the primary input, but a terminal is still a
  // browser: a keyboard should type digits and Backspace/Escape should do
  // what they do everywhere else.
  useEffect(() => {
    if (!picked) return;
    function onKey(event: KeyboardEvent) {
      if (event.key >= "0" && event.key <= "9") press(event.key);
      else if (event.key === "Backspace") press("del");
      else if (event.key === "Escape") back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!picked) {
    return (
      <section aria-label="Who is on" className="px-5 pb-16 sm:px-10 lg:px-14">
        <p className="pt-10 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
          Who is on
        </p>

        {roster.length === 0 ? (
          <p className="mt-6 border-y border-kds-border py-10 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
            Nobody on the roster yet.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-kds-border border-y border-kds-border">
            {roster.map((person) => (
              <li key={person.id}>
                <motion.button
                  type="button"
                  onClick={() => setPicked(person)}
                  whileTap={{ scale: 0.995 }}
                  transition={pressSpring}
                  className="flex w-full items-baseline justify-between gap-6 py-7 text-left transition-colors hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kds-text-primary sm:py-9"
                >
                  <span className="font-serif text-[clamp(28px,3.2vw,44px)] leading-[1.05] tracking-[-0.02em]">
                    {person.display_name}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
                    {ROLE_LABELS[person.role]}
                  </span>
                </motion.button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label={`PIN for ${picked.display_name}`}
      className="px-5 pb-16 sm:px-10 lg:px-14"
    >
      <button
        type="button"
        onClick={back}
        className="pt-10 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase transition-colors hover:text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
      >
        <span aria-hidden>← </span>Not {picked.display_name}
      </button>

      <p className="mt-6 font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em]">
        {picked.display_name}
      </p>

      {/* The punchcard's glyphs, borrowed: filled is what you have entered. */}
      <p aria-hidden className="mt-7 flex gap-3 text-[28px] leading-none">
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              "transition-colors duration-150",
              i < pin.length ? "text-accent-primary" : "text-kds-border",
            )}
          >
            {i < pin.length ? "●" : "○"}
          </span>
        ))}
      </p>

      <p
        role="status"
        className="mt-4 h-4 font-mono text-[11px] tracking-[0.14em] uppercase"
      >
        <AnimatePresence mode="wait">
          {error && (
            <motion.span
              key={error}
              initial={reduced ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring}
              className="inline-block text-badge-alert"
            >
              {error}
            </motion.span>
          )}
        </AnimatePresence>
      </p>

      <div className="mt-8 grid max-w-[340px] grid-cols-3 border-t border-l border-kds-border">
        {KEYS.map((key, i) =>
          key === "" ? (
            <div
              key={i}
              aria-hidden
              className="aspect-4/3 border-r border-b border-kds-border"
            />
          ) : (
            <motion.button
              key={i}
              type="button"
              disabled={pending}
              onClick={() => press(key)}
              whileTap={{ scale: 0.97 }}
              transition={pressSpring}
              aria-label={key === "del" ? "Delete last digit" : key}
              className={cn(
                "flex aspect-4/3 items-center justify-center border-r border-b border-kds-border",
                "font-mono text-[24px] tabular-nums transition-colors",
                "hover:bg-kds-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kds-text-primary",
                "disabled:text-kds-text-secondary",
              )}
            >
              {key === "del" ? <Delete size={20} aria-hidden /> : key}
            </motion.button>
          ),
        )}
      </div>
    </section>
  );
}
