import type { DayReport as Report } from "@/types/day";
import { vatLabel } from "@/lib/vat";
import { cn } from "@/lib/utils";

const money = (n: number) => `€${n.toFixed(2)}`;

/** One group of rows between two hairlines. The page is three of these. */
function Group({ rows }: { rows: [string, string, string?][] }) {
  return (
    <ul className="divide-y divide-kds-border border-y border-kds-border">
      {rows.map(([label, value, tone]) => (
        <li key={label} className="flex items-baseline justify-between gap-6 py-4">
          <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
            {label}
          </span>
          <span className={cn("font-mono text-[15px] tabular-nums", tone ?? "text-kds-text-primary")}>
            {value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DayReport({ report }: { report: Report }) {
  return (
    <div className="mt-10 max-w-lg space-y-10">
      <Group
        rows={[
          ["Taken", money(report.taken)],
          ["Cash", money(report.cash)],
          ["Card at the bar", money(report.card)],
          ["Online", money(report.online)],
        ]}
      />
      <Group
        rows={[
          [vatLabel(0.11), money(report.vat)],
          ["Net", money(report.net)],
        ]}
      />
      <Group
        rows={[
          ["Discounted", `−${money(report.discounted)}`, "text-accent-primary"],
          ["Voided", money(report.voided), "text-badge-alert"],
          ["Refunded", money(report.refunded), "text-badge-alert"],
          ["Binned", money(report.binned), "text-badge-alert"],
        ]}
      />
      <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-kds-text-secondary uppercase">
        Left on the counter
        <span aria-hidden className="mx-3 text-kds-border">/</span>
        {report.left.length === 0
          ? "Nothing"
          : report.left.map((row) => `${row.left} ${row.name}`).join(" / ")}
      </p>
    </div>
  );
}
