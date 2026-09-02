"use client";

import { AGE_TONES, ageFraction, ageTier } from "@/lib/order-age";
import { cn } from "@/lib/utils";

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
