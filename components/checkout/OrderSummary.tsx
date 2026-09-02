"use client";

import { cartTotal, lineTotal, type CartLine } from "@/lib/cart";
import { cn } from "@/lib/utils";
import { groupByRate, vatLabel } from "@/lib/vat";

export function OrderSummary({
  lines,
  errorItemId,
  errorMessage,
}: {
  lines: CartLine[];
  errorItemId?: string;
  errorMessage?: string;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
        On the pass
      </p>

      <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
        {lines.map((line) => {
          const flagged = errorItemId === line.menuItemId;
          return (
            <li key={line.id} className="py-5">
              <div className="flex items-baseline justify-between gap-4">
                <span
                  className={cn(
                    "font-serif text-[22px] leading-[1.05] tracking-[-0.02em]",
                    flagged ? "text-text-tertiary" : "text-text-primary",
                  )}
                >
                  {line.name}
                </span>
                <span className="font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums text-text-primary">
                  €{lineTotal(line).toFixed(2)}
                </span>
              </div>

              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase">
                <span>×{line.quantity}</span>
                {line.selectedModifiers.map((modifier) => (
                  <span key={modifier.group} className="flex items-center gap-3">
                    <span aria-hidden className="text-hairline">
                      /
                    </span>
                    {modifier.option}
                  </span>
                ))}
              </p>

              {flagged && errorMessage && (
                <p
                  role="status"
                  className="mt-2 font-mono text-[11px] font-medium tracking-[0.14em] text-badge-alert uppercase"
                >
                  {errorMessage}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-text-tertiary uppercase">
          Total
        </span>
        <span className="font-mono text-[15px] font-medium tracking-[0.02em] tabular-nums text-text-primary">
          €{cartTotal(lines).toFixed(2)}
        </span>
      </div>

      {groupByRate(
        lines.map((line) => ({ line_total: lineTotal(line), vat_rate: line.vatRate })),
      ).map(({ rate, vat }) => (
        <p
          key={rate}
          className="mt-2 text-right font-mono text-[11px] font-medium tracking-[0.14em] text-text-tertiary uppercase"
        >
          {vatLabel(rate)}
          <span aria-hidden className="mx-3 text-hairline">/</span>
          <span className="tabular-nums">€{vat.toFixed(2)}</span>
        </p>
      ))}
    </div>
  );
}
