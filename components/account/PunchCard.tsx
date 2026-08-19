const CARD_LENGTH = 12;

/**
 * Twelve glyphs on a row. Deliberately not a progress bar: the whole point of a
 * card is that you can count what is left at a glance.
 */
export function PunchCard({
  punches,
  size = "sm",
}: {
  punches: number;
  size?: "sm" | "lg";
}) {
  const filled = Math.max(0, Math.min(punches, CARD_LENGTH));
  const left = CARD_LENGTH - filled;

  return (
    <div>
      <p
        aria-hidden
        className={
          size === "lg"
            ? "flex gap-3 text-[28px] leading-none text-text-primary"
            : "flex gap-2 text-[15px] leading-none text-text-primary"
        }
      >
        {Array.from({ length: CARD_LENGTH }, (_, i) => (
          <span key={i} className={i < filled ? "text-text-primary" : "text-hairline"}>
            {i < filled ? "●" : "○"}
          </span>
        ))}
      </p>

      <p
        role="status"
        className="mt-4 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-text-secondary"
      >
        {left === 0 ? (
          <span className="text-accent-primary">
            Card full — one drink on us, pick it at checkout
          </span>
        ) : (
          <>
            {filled} {filled === 1 ? "cup" : "cups"} in
            <span aria-hidden className="mx-3 text-hairline">
              /
            </span>
            {left} to go
          </>
        )}
      </p>
    </div>
  );
}
