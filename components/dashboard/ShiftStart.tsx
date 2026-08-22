"use client";

import { useEffect } from "react";

export function ShiftStart({ onStart }: { onStart: () => void }) {
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
      </button>
    </div>
  );
}
