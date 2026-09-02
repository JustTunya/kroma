"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { closeServiceAction } from "@/app/dashboard/actions";
import { countTotal, DENOMINATIONS, varianceWord } from "@/lib/cash";
import { numberTransition, pressSpring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { DayReport } from "@/types/day";

const money = (n: number) => `€${n.toFixed(2)}`;

export function CashCount({ report }: { report: DayReport }) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counted = countTotal(counts);
  const variance = countTotal(counts) - report.expected_cash;
  const { word, tone } = varianceWord(variance);

  function close() {
    setError(null);
    startTransition(async () => {
      const result = await closeServiceAction(counted, counts);
      if (result.ok) {
        router.push("/dashboard/day");
        router.refresh();
      } else {
        setError(result.error ?? "That did not go through.");
      }
    });
  }

  return (
    <div className="mt-10 grid gap-12 md:grid-cols-2 md:gap-0">
      <div className="md:pr-14">
        <ul className="divide-y divide-kds-border border-y border-kds-border">
          {DENOMINATIONS.map((denomination) => {
            const rowTotal = (counts[String(denomination)] ?? 0) * denomination;
            return (
              <li key={denomination} className="flex items-center justify-between gap-6 py-4">
                <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-kds-text-secondary uppercase">
                  {denomination >= 1 ? `€${denomination}` : `${denomination * 100}c`}
                </span>
                <div className="flex items-center gap-5">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={999}
                    value={Number.isInteger(counts[String(denomination)]) ? counts[String(denomination)] : ""}
                    onChange={(event) =>
                      setCounts((current) => ({
                        ...current,
                        [String(denomination)]: event.target.valueAsNumber,
                      }))
                    }
                    aria-label={`How many ${denomination >= 1 ? `€${denomination}` : `${denomination * 100} cent`} counted`}
                    className="h-10 w-20 border-b border-kds-border bg-transparent text-right font-mono text-[15px] tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
                  />
                  <div className="w-16 overflow-hidden text-right">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={rowTotal}
                        {...numberTransition}
                        className="block font-mono text-[13px] tabular-nums text-kds-text-secondary"
                      >
                        {money(rowTotal)}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 font-serif text-[clamp(40px,6vw,72px)] leading-[0.95] tracking-[-0.03em] tabular-nums">
          {money(counted)}
        </p>
      </div>

      <div className="md:border-l md:border-kds-border md:pl-14">
        <ul className="divide-y divide-kds-border border-y border-kds-border">
          <li className="flex items-baseline justify-between gap-6 py-4">
            <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
              Float
            </span>
            <span className="font-mono text-[15px] tabular-nums">{money(report.float)}</span>
          </li>
          <li className="flex items-baseline justify-between gap-6 py-4">
            <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
              Cash taken
            </span>
            <span className="font-mono text-[15px] tabular-nums">{money(report.cash)}</span>
          </li>
          <li className="flex items-baseline justify-between gap-6 py-4">
            <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
              Cash refunded
            </span>
            <span className="font-mono text-[15px] tabular-nums">
              −{money(report.cash_refunded)}
            </span>
          </li>
          <li className="flex items-baseline justify-between gap-6 py-4">
            <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
              Expected
            </span>
            <span className="font-mono text-[15px] tabular-nums">{money(report.expected_cash)}</span>
          </li>
          <li className="flex items-baseline justify-between gap-6 py-4">
            <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
              Counted
            </span>
            <span className="font-mono text-[15px] tabular-nums">{money(counted)}</span>
          </li>
        </ul>

        <p
          role="status"
          className={cn(
            "mt-6 font-mono text-[11px] font-medium tracking-[0.14em] uppercase",
            tone === "live" ? "text-badge-live" : "text-badge-alert",
          )}
        >
          {word}
          {word !== "Square" && <span className="ml-2 tabular-nums">{money(Math.abs(variance))}</span>}
        </p>

        {report.live.length > 0 ? (
          <p role="status" className="mt-8 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase">
            {report.live.length} still on the pass
            <span aria-hidden className="mx-3 text-kds-border">/</span>
            {report.live.map((order, i) => (
              <span key={order.id}>
                {i > 0 && <span aria-hidden className="mx-3 text-kds-border">/</span>}
                <Link href={`/dashboard/order/${order.id}`} className="underline underline-offset-4">
                  #{String(order.number).padStart(3, "0")}
                </Link>
              </span>
            ))}
          </p>
        ) : (
          <motion.button
            type="button"
            onClick={close}
            disabled={pending}
            whileTap={{ scale: 0.98 }}
            transition={pressSpring}
            className="mt-8 h-10 rounded-full bg-accent-primary px-6 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary disabled:bg-kds-surface disabled:text-kds-text-secondary"
          >
            {pending ? "Closing" : "Close the day"}
          </motion.button>
        )}

        {error && (
          <p role="status" className="mt-4 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
