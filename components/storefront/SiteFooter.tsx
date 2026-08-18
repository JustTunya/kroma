const DETAILS = [
  { label: "Where", lines: ["Str. Universității 12", "Cluj-Napoca, Romania"] },
  { label: "Hours", lines: ["Mon-Fri 07:30-18:00", "Sat-Sun 08:30-17:00"] },
  { label: "Collect", lines: ["Order ahead, pick up", "at the bar"] },
];

export function SiteFooter() {
  return (
    <footer className="overflow-hidden bg-text-primary text-surface-canvas">
      <div className="grid gap-10 px-5 pt-16 pb-14 sm:grid-cols-3 sm:px-10 lg:px-14 lg:pt-24">
        {DETAILS.map((detail) => (
          <div key={detail.label}>
            <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
              {detail.label}
            </p>
            <div className="mt-4 space-y-1 font-mono text-[13px] leading-[1.6] tracking-[0.02em]">
              {detail.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div aria-hidden className="px-5 sm:px-10 lg:px-14">
        <svg viewBox="0 0 560 112" className="w-full" role="presentation">
          <text
            x="0"
            y="100"
            textLength="560"
            lengthAdjust="spacing"
            fill="currentColor"
            className="font-serif text-[136px]"
          >
            KROMA
          </text>
        </svg>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-kds-border px-5 py-6 font-mono text-[10px] font-medium tracking-[0.16em] text-kds-text-secondary uppercase sm:px-10 lg:px-14">
        <span>Specialty roastery &amp; micro-bakehouse</span>
        <span>Roasted and baked in Cluj</span>
      </div>
    </footer>
  );
}
