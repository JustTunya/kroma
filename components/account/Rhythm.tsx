"use client";

import { motion, useReducedMotion } from "framer-motion";

import { DAYS, DAYS_LONG, type Rhythm as RhythmData } from "@/lib/account-stats";
import { glide, inView } from "@/lib/reveal";
import { cn } from "@/lib/utils";

const MAX_DOTS = 8;
const MIN_FOR_PATTERN = 3;

const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-accent-hover uppercase">
      {children}
    </p>
  );
}

export function Rhythm({
  rhythm,
  since,
  stats,
  average,
}: {
  rhythm: RhythmData;
  since: string;
  stats: { label: string; value: string }[];
  average: string | null;
}) {
  const reduced = useReducedMotion();
  const known = rhythm.total >= MIN_FOR_PATTERN && rhythm.peakDay !== null && rhythm.peakHour !== null;

  return (
    <section aria-labelledby="rhythm-h" className="grid border-b border-hairline lg:grid-cols-2">
      <div className="border-b border-hairline px-5 py-16 sm:px-10 lg:border-b-0 lg:px-14 lg:py-24">
        <Eyebrow>Your week</Eyebrow>
        <h2
          id="rhythm-h"
          className="mt-6 max-w-[16ch] font-serif text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em] text-text-primary"
        >
          {known
            ? `Around ${hour(rhythm.peakHour!)}, mostly ${DAYS_LONG[rhythm.peakDay!]}s`
            : "Still learning your week"}
        </h2>

        <motion.div
          aria-hidden
          initial={reduced ? false : "hidden"}
          whileInView="visible"
          viewport={inView}
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          className="mt-10 grid max-w-md grid-cols-7 gap-3"
        >
          {DAYS.map((day, d) => {
            const count = rhythm.byDay[d];
            const dots = Math.min(count, MAX_DOTS);

            return (
              <div key={day} className="flex flex-col items-center gap-3">
                <div className="flex h-28 flex-col-reverse items-center gap-1.5 sm:h-32">
                  {Array.from({ length: Math.max(dots, 1) }, (_, i) => (
                    <motion.span
                      key={i}
                      variants={{
                        hidden: { opacity: 0, scale: 0.3 },
                        visible: { opacity: 1, scale: 1 },
                      }}
                      transition={{ ...glide, delay: i * 0.03 }}
                      className={cn(
                        "size-3 rounded-full sm:size-3.5",
                        count === 0
                          ? "border border-hairline"
                          : known && d === rhythm.peakDay
                            ? "bg-accent-primary"
                            : "bg-text-primary",
                      )}
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] font-medium tracking-[0.12em] text-text-secondary uppercase">
                  {day}
                </span>
              </div>
            );
          })}
        </motion.div>

        <ul className="sr-only" aria-label="Orders by weekday">
          {DAYS_LONG.map((day, d) => (
            <li key={day}>
              {day}: {rhythm.byDay[d]}
            </li>
          ))}
        </ul>

        <p className="mt-10 max-w-md text-[16px] leading-[1.6] text-text-secondary">
          {known
            ? "Order ahead from the queue before you leave and it is on the pass when you arrive."
            : "Order a few times and your week shows up here."}
        </p>
      </div>

      <div className="border-hairline px-5 py-16 sm:px-10 lg:border-l lg:px-14 lg:py-24">
        <Eyebrow>Since {since}</Eyebrow>
        <dl className="mt-10 grid grid-cols-2 gap-px border border-hairline bg-hairline">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-surface-canvas px-5 py-7 sm:px-7 sm:py-9">
              <dd className="font-serif text-[clamp(34px,4.4vw,60px)] leading-none tracking-[-0.02em] text-text-primary tabular-nums">
                {stat.value}
              </dd>
              <dt className="mt-3 font-mono text-[11px] font-medium tracking-[0.14em] text-text-secondary uppercase">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
        {average && (
          <p className="mt-6 font-mono text-[11px] font-medium tracking-[0.14em] text-text-secondary uppercase">
            {average}
          </p>
        )}
      </div>
    </section>
  );
}
