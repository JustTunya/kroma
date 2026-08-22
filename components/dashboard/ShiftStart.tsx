"use client";

/**
 * The screen the bar taps once at open.
 *
 * It exists for a browser rule, not a product one: iPadOS keeps audio
 * suspended until a user gesture, so without a deliberate tap the first order
 * of the day arrives in silence. Rather than hide that behind a mysterious
 * "enable sound" control, it becomes the moment the shift starts.
 *
 * Deliberately not a modal over the board: there is nothing to dismiss and
 * nothing behind it worth reading yet.
 *
 * A plain div, and no entrance. Something whose whole job is to cover the
 * screen must not depend on an animation landing — an earlier fade left it
 * translucent with the board legible underneath, which is worse than no
 * transition at all. z-50 to sit with the header rather than under it.
 */
export function ShiftStart({ onStart }: { onStart: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-kds-canvas">
      <button
        type="button"
        onClick={onStart}
        className="flex size-full flex-col items-start justify-end px-5 pb-16 text-left focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-kds-text-primary sm:px-10 lg:px-14"
      >
        <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
          Roasted Tuesday. Baked this morning.
        </span>

        <span className="mt-6 max-w-[16ch] font-serif text-[clamp(56px,10vw,148px)] leading-[0.92] tracking-[-0.03em]">
          Tap to start <em className="text-accent-primary">the shift</em>
        </span>

        <span className="mt-7 max-w-md font-mono text-[11px] leading-[1.6] tracking-[0.02em] text-kds-text-secondary">
          One tap turns the sound on. New orders ping; nothing else does.
        </span>
      </button>
    </div>
  );
}
