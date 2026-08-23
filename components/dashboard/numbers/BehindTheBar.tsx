import { MetaLine } from "@/components/dashboard/numbers/MetaLine";
import { duration } from "@/lib/manage";
import { ROLE_LABELS } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";

import type { MetaPart } from "@/components/dashboard/numbers/MetaLine";
import type { BarStat } from "@/types/manage";

/**
 * Who made what, on hairline rows rather than in a table.
 *
 * The 2px rule down the left edge is the board's AgeSpine borrowed: there it
 * fills as one order waits, here it fills with a person's share of everything
 * that went out. Same vocabulary, so the two screens read as one building —
 * and it is the only comparison on the row, because a manager reading this is
 * looking for the outlier, not auditing a spreadsheet.
 *
 * "Started" is deliberately not "made": claimed_by is stamped when an order
 * enters brewing and nothing in the schema records who handed it over. A stat
 * that quietly means something other than its label is how people get blamed
 * for someone else's morning.
 */
export function BehindTheBar({ people }: { people: BarStat[] }) {
  const busiest = Math.max(...people.map((p) => p.made), 1);
  const worked = people.filter((p) => p.seconds > 0 || p.made > 0);

  if (worked.length === 0) {
    return (
      <p className="border-y border-kds-border py-10 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
        Nobody was on shift in this window.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-kds-border border-y border-kds-border">
      {worked.map((person) => {
        const hitRate = person.timed
          ? Math.round((person.under_five / person.timed) * 100)
          : null;

        const stats: MetaPart[] = [
          { text: `${duration(person.seconds)} on shift` },
          { text: `${person.made} started` },
          ...(person.seconds
            ? [
                {
                  text: `${(person.made / (person.seconds / 3600)).toFixed(1)} an hour`,
                },
              ]
            : []),
          { text: `${duration(person.median_seconds)} median to ready` },
          ...(hitRate !== null
            ? [
                {
                  text: `${hitRate}% under five minutes`,
                  tone: hitRate >= 80 ? "text-badge-live" : undefined,
                },
              ]
            : []),
        ];

        // Only rendered when there is something in it. An empty exceptions
        // line on every row trains people to stop reading it.
        const exceptions: MetaPart[] = [
          ...(person.eighty_sixed ? [{ text: `${person.eighty_sixed} × 86'd` }] : []),
          ...(person.stepped_back
            ? [{ text: `${person.stepped_back} stepped back late` }]
            : []),
          ...(person.voided
            ? [{ text: `${person.voided} voided`, tone: "text-badge-alert" }]
            : []),
          ...(person.refunded
            ? [{ text: `${person.refunded} refunded`, tone: "text-badge-alert" }]
            : []),
        ];

        return (
          <li key={person.id} className="flex gap-4 py-7 sm:py-9">
            <span
              aria-hidden
              className="relative block w-[2px] shrink-0 self-stretch bg-kds-border"
            >
              <span
                className="absolute inset-x-0 bottom-0 h-full origin-bottom bg-kds-text-primary"
                style={{ transform: `scaleY(${person.made / busiest})` }}
              />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-6">
                <h3 className="min-w-0 truncate font-serif text-[clamp(24px,2.6vw,34px)] leading-[1.05] tracking-[-0.02em]">
                  {person.name}
                </h3>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10px] font-medium tracking-[0.18em] uppercase",
                    person.on_shift ? "text-badge-live" : "text-kds-text-secondary",
                  )}
                >
                  {person.on_shift ? "On shift" : ROLE_LABELS[person.role]}
                </span>
              </div>

              <MetaLine parts={stats} className="mt-4 leading-[1.7]" />
              {exceptions.length > 0 && (
                <MetaLine
                  parts={exceptions}
                  className="mt-2.5 text-kds-text-secondary"
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
