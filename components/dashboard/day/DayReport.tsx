import Link from "next/link";

import type { DayReport as Report } from "@/types/day";
import { vatLabel } from "@/lib/vat";
import { cn } from "@/lib/utils";
import { MetaLine } from "@/components/dashboard/numbers/MetaLine";

const money = (n: number) => `€${n.toFixed(2)}`;

export function DayReport({ report, canClose }: { report: Report; canClose: boolean }) {
  const givenAway = report.discounted + report.voided + report.refunded + report.binned;

  return (
    <section
      aria-label="The till"
      className="border-t border-kds-border px-5 py-16 sm:px-10 lg:px-14 lg:py-24"
    >
      <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
        The till
      </p>
      <h2 className="mt-4 font-serif text-[clamp(28px,3.4vw,44px)] leading-[1.05] tracking-[-0.02em]">
        What&rsquo;s in the drawer
      </h2>

      <p className="mt-10 font-serif text-[clamp(48px,8vw,96px)] leading-[0.95] tracking-[-0.03em] tabular-nums">
        {money(report.taken)}
      </p>
      <MetaLine
        className="mt-6 text-kds-text-secondary"
        parts={[
          { text: `${money(report.cash)} cash` },
          { text: `${money(report.card)} card at the bar` },
          { text: `${money(report.online)} online` },
        ]}
      />

      <div className="mt-10 grid gap-x-14 gap-y-10 border-t border-kds-border pt-8 md:grid-cols-2">
        <div>
          <h3 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
            Net of tax
          </h3>
          <p className="mt-3 font-mono text-[22px] font-medium tabular-nums">{money(report.net)}</p>
          <MetaLine
            className="mt-3 text-kds-text-secondary"
            parts={[{ text: `${vatLabel(0.11)}, ${money(report.vat)}` }]}
          />
        </div>

        <div className="md:border-l md:border-kds-border md:pl-14">
          <h3 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
            Given away and lost
          </h3>
          <p className="mt-3 font-mono text-[22px] font-medium tabular-nums">
            <span className={givenAway > 0 ? "text-badge-alert" : undefined}>{money(givenAway)}</span>
          </p>
          <MetaLine
            className="mt-3"
            parts={[
              { text: `${money(report.discounted)} discounted`, tone: "text-accent-primary" },
              { text: `${money(report.voided)} voided`, tone: "text-badge-alert" },
              { text: `${money(report.refunded)} refunded`, tone: "text-badge-alert" },
              { text: `${money(report.binned)} binned`, tone: "text-badge-alert" },
            ]}
          />
        </div>
      </div>

      <div className="mt-10 border-t border-kds-border pt-8">
        <h3 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
          Left on the counter
        </h3>
        {report.left.length === 0 ? (
          <p className="mt-6 border-y border-kds-border py-10 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
            Nothing left.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-kds-border border-y border-kds-border">
            {report.left.map((row) => (
              <li key={row.name} className="flex items-baseline justify-between gap-6 py-4">
                <span className="font-serif text-[20px] leading-[1.2] tracking-[-0.02em]">{row.name}</span>
                <span className="shrink-0 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase tabular-nums">
                  {row.left} left
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canClose && (
        <div className="mt-10 border-t border-kds-border pt-8">
          <p className="max-w-md font-sans text-[15px] leading-[1.6] text-kds-text-secondary">
            Count what&rsquo;s in the drawer against this and close the day.
          </p>
          <Link
            href="/dashboard/day/close"
            className={cn(
              "mt-6 inline-flex h-10 items-center rounded-full bg-accent-primary px-5",
              "font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase",
              "transition-colors hover:bg-accent-hover",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary",
            )}
          >
            Count the drawer
          </Link>
        </div>
      )}
    </section>
  );
}
