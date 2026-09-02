import { cn } from "@/lib/utils";

export type MetaPart = { text: string; tone?: string };

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
