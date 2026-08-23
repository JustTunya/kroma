"use client";

import { AGE_TONES, ageFraction, ageTier } from "@/lib/order-age";
import { cn } from "@/lib/utils";

/**
 * The signature element.
 *
 * A 2px rule down the left edge of every row, filling from the bottom as the
 * order waits and stepping colour at five and ten minutes.
 *
 * Deliberately not a progress bar and deliberately not the coloured card
 * border every other kitchen display uses: this brand builds structure out of
 * single-pixel rules, so urgency is expressed in the same vocabulary as
 * everything else. Only the fill animates, and it animates on scaleY, so a
 * ticking board never lays out twice.
 */
export function AgeSpine({ since, now }: { since: Date; now: Date }) {
  const tier = ageTier(since, now);

  return (
    <span
      aria-hidden
      className="relative block w-[2px] shrink-0 self-stretch bg-kds-border"
    >
      <span
        className={cn(
          "absolute inset-x-0 bottom-0 h-full origin-bottom transition-colors duration-300",
          AGE_TONES[tier].spine,
        )}
        style={{ transform: `scaleY(${ageFraction(since, now)})` }}
      />
    </span>
  );
}
