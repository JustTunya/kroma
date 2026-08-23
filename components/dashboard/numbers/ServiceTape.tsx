"use client";

import { motion, useReducedMotion } from "framer-motion";

import { TAPE_STACK, euros, hourLabel, tapeScale } from "@/lib/manage";
import { glide } from "@/lib/reveal";
import { cn } from "@/lib/utils";

import type { HourSlice } from "@/types/manage";

/**
 * Demand and cover on one axis.
 *
 * Every kitchen dashboard draws a bar chart of orders per hour and stops
 * there, which answers half the question. The half a manager actually acts on
 * is whether anyone was standing there when it hit — so the orders sit above
 * the rule as counted ticks, and the staff time sits below it as a solid
 * block, sharing the hours. A tall stack over a thin block is a morning that
 * went badly, and it reads that way before you have read a single number.
 *
 * Two vocabularies on purpose: demand is discrete and countable, so it is
 * drawn in the hairlines this brand builds everything else from, one per
 * order. Cover is continuous, so it is drawn as mass.
 */

/** How deep the cover block runs below the axis. */
const COVER = 44;
/** The shop is open 07:30–18:00, so the axis always shows at least that. */
const OPEN_FROM = 7;
const OPEN_TO = 17;

export function ServiceTape({
  hours,
  /** Staff-hours below the axis are a total; over a week they need saying so. */
  days,
}: {
  hours: HourSlice[];
  days: number;
}) {
  const reduced = useReducedMotion();

  const by = new Map(hours.map((slice) => [slice.hour, slice]));
  const present = hours.filter((slice) => slice.orders > 0 || slice.seconds > 0);
  const lo = Math.min(OPEN_FROM, ...present.map((s) => s.hour));
  const hi = Math.max(OPEN_TO, ...present.map((s) => s.hour));

  const columns = Array.from({ length: hi - lo + 1 }, (_, i) => {
    const hour = lo + i;
    return (
      by.get(hour) ?? { hour, orders: 0, taken: 0, lost: 0, lost_orders: 0, seconds: 0 }
    );
  });

  const busiest = columns.reduce((a, b) => (b.orders > a.orders ? b : a), columns[0]);
  const maxSeconds = Math.max(...columns.map((c) => c.seconds), 1);

  const { perTick, pitch } = tapeScale(busiest.orders);
  const ticksAt = (orders: number) => Math.round(orders / perTick);

  const total = columns.reduce((sum, c) => sum + c.orders, 0);

  return (
    <div>
      <p className="max-w-lg font-sans text-[15px] leading-[1.6] text-kds-text-secondary">
        {total === 0 ? (
          "Nothing came through in this window."
        ) : (
          <>
            Busiest between{" "}
            <span className="text-kds-text-primary">
              {hourLabel(busiest.hour)}:00 and {hourLabel(busiest.hour + 1)}:00
            </span>{" "}
            — {busiest.orders} {busiest.orders === 1 ? "order" : "orders"},{" "}
            {euros(busiest.taken)} taken
            {busiest.seconds > 0 &&
              `, ${(busiest.seconds / 3600).toFixed(1)} staff-hours on the floor`}
            .
          </>
        )}
      </p>

      <div className="scrollbar-hide -mx-5 mt-10 overflow-x-auto px-5 sm:-mx-10 sm:px-10 lg:-mx-14 lg:px-14">
        <div
          aria-hidden
          className="flex min-w-[640px] items-end gap-px"
          style={{ height: TAPE_STACK + COVER + 28 }}
        >
          {columns.map((slice, i) => {
            const ticks = ticksAt(slice.orders);
            const keptTicks = ticksAt(slice.orders - slice.lost_orders);

            return (
              <div
                key={slice.hour}
                title={`${hourLabel(slice.hour)}:00 — ${slice.orders} orders, ${euros(
                  slice.taken,
                )} taken, ${(slice.seconds / 3600).toFixed(1)}h cover`}
                className="group flex min-w-0 flex-1 flex-col justify-end"
              >
                {/* Demand: one hairline per order, losses stacked on top so a
                    bad hour is speckled rust at the tip rather than a
                    separate bar nobody lines up. */}
                <div
                  className="flex flex-col-reverse items-stretch justify-start gap-px overflow-hidden px-[3px]"
                  style={{ height: TAPE_STACK }}
                >
                  {Array.from({ length: ticks }, (_, n) => (
                    <motion.span
                      key={n}
                      className={cn(
                        "block w-full shrink-0 origin-bottom",
                        n < keptTicks ? "bg-kds-text-primary" : "bg-badge-alert",
                      )}
                      style={{ height: Math.max(1, pitch - 1) }}
                      initial={reduced ? false : { scaleY: 0, opacity: 0 }}
                      animate={{ scaleY: 1, opacity: 1 }}
                      transition={{ ...glide, delay: reduced ? 0 : i * 0.02 }}
                    />
                  ))}
                </div>

                <span className="block h-px w-full bg-kds-border" />

                {/* Cover: mass, not count. */}
                <div style={{ height: COVER }} className="px-[3px]">
                  <motion.span
                    className="block w-full origin-top bg-kds-text-secondary/30"
                    style={{
                      height: slice.seconds
                        ? Math.max(2, (slice.seconds / maxSeconds) * COVER)
                        : 0,
                    }}
                    initial={reduced ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ ...glide, delay: reduced ? 0 : i * 0.02 }}
                  />
                </div>

                <span
                  className={cn(
                    "mt-2 text-center font-mono text-[10px] font-medium tracking-[0.02em] tabular-nums",
                    slice.hour === busiest.hour && busiest.orders > 0
                      ? "text-accent-primary"
                      : "text-kds-text-secondary",
                  )}
                >
                  {hourLabel(slice.hour)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
        <Key className="bg-kds-text-primary">
          {perTick === 1 ? "Order kept" : `${perTick} orders kept`}
        </Key>
        <Key className="bg-badge-alert">Voided, refunded or binned</Key>
        <Key className="bg-kds-text-secondary/30">
          Staff time on the floor{days > 1 && `, ${days} days added up`}
        </Key>
      </ul>
    </div>
  );
}

function Key({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className={cn("block h-[3px] w-4 shrink-0", className)} />
      {children}
    </li>
  );
}
