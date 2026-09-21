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

    if (next.length === PIN_LENGTH && picked) submit(picked.id, next);
  }

  function back() {
    setPicked(null);
    setPin("");
    setError(null);
  }

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

  const shell =
    "mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-sm flex-col items-center justify-center px-5 py-10 text-center";
  const eyebrow =
    "font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase";

  if (!picked) {
    return (
      <section aria-label="Who is on" className={shell}>
        <p className={eyebrow}>Who is on</p>

        {roster.length === 0 ? (
          <p className="mt-8 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
            Nobody on the roster yet.
          </p>
        ) : (
          <ul className="mt-8 w-full divide-y divide-kds-border border-y border-kds-border">
            {roster.map((person) => (
              <li key={person.id}>
                <motion.button
                  type="button"
                  onClick={() => setPicked(person)}
                  whileTap={{ scale: 0.99 }}
                  transition={pressSpring}
                  className="flex w-full items-baseline justify-between gap-6 py-5 text-left transition-colors hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kds-text-primary"
                >
                  <span className="font-serif text-[28px] leading-[1.05] tracking-[-0.02em]">
                    {person.display_name}
                  </span>
                  <span className={cn(eyebrow, "shrink-0")}>
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
    <section aria-label={`PIN for ${picked.display_name}`} className={shell}>
      <p className={eyebrow}>{ROLE_LABELS[picked.role]}</p>
      <p className="mt-3 font-serif text-[40px] leading-[1.05] tracking-[-0.02em]">
        {picked.display_name}
      </p>

      <p aria-hidden className="mt-8 flex gap-4">
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-3 rounded-full border transition-colors duration-150",
              i < pin.length
                ? "border-accent-primary bg-accent-primary"
                : "border-kds-border bg-transparent",
            )}
          />
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

      <div className="mt-8 grid grid-cols-3 gap-x-5 gap-y-4">
        {KEYS.map((key, i) =>
          key === "" ? (
            <div key={i} aria-hidden className="size-[72px]" />
          ) : (
            <motion.button
              key={i}
              type="button"
              disabled={pending}
              onClick={() => press(key)}
              whileTap={{ scale: 0.94 }}
              transition={pressSpring}
              aria-label={key === "del" ? "Delete last digit" : key}
              className={cn(
                "flex size-[72px] items-center justify-center rounded-full",
                "font-mono text-[24px] tabular-nums transition-colors",
                key === "del"
                  ? "text-kds-text-secondary hover:text-kds-text-primary"
                  : "border border-kds-border hover:bg-kds-surface",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
                "disabled:text-kds-text-secondary",
              )}
            >
              {key === "del" ? <Delete size={20} aria-hidden /> : key}
            </motion.button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={back}
        className={cn(
          eyebrow,
          "mt-10 transition-colors hover:text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
        )}
      >
        Not {picked.display_name}
      </button>
    </section>
  );
}
