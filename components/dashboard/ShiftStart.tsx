"use client";

import { useEffect } from "react";

/**
 * The one deliberate tap that opens a shift. It is not a splash screen: it
 * only appears to someone who has already entered their PIN and has no shift
 * running, and the tap is what gets stamped in staff_events.
 */
export function ShiftStart({
  onStart,
  error,
}: {
  onStart: () => void;
  error?: string | null;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-kds-canvas">
      <button
        type="button"
        onClick={onStart}
        className="flex size-full flex-col items-start justify-end px-5 pb-16 text-left focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-kds-text-primary sm:px-10 lg:px-14"
      >
        <span className="max-w-[16ch] font-serif text-[clamp(56px,10vw,148px)] leading-[0.92] tracking-[-0.03em]">
          Tap to start <em className="text-accent-primary">the shift</em>
        </span>

        {error && (
          <span
            role="status"
            className="mt-6 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase"
          >
            {error}
          </span>
        )}
      </button>
    </div>
  );
}
