import { cn } from "@/lib/utils";

/** One metric on a spec line. */
export type MetaPart = { text: string; tone?: string };

/**
 * The storefront's spec line: mono uppercase at 11px, parts joined by a `/`
 * glyph in hairline. Built from an array rather than from siblings so the
 * separator can never trail off the end of a line that dropped its last part.
 */
export function MetaLine({
  parts,
  className,
}: {
  parts: MetaPart[];
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] tracking-[0.14em] uppercase",
        className,
      )}
    >
      {parts.map((part, i) => (
        <span key={part.text}>
          {i > 0 && (
            <span aria-hidden className="mx-2.5 text-kds-border">
              /
            </span>
          )}
          <span className={part.tone}>{part.text}</span>
        </span>
      ))}
    </p>
  );
}
