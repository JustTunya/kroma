import Link from "next/link";

export function BarProfile({
  called,
  diet,
  avoiding,
}: {
  called: string;
  diet: string[];
  avoiding: string[];
}) {
  const rows = [
    ["Called at the bar", called],
    ["Diet", diet.join(" / ") || "No preference"],
    ["Avoiding", avoiding.join(" / ") || "Nothing"],
  ];

  return (
    <div className="border-hairline px-5 py-16 sm:px-10 md:border-l lg:px-14 lg:py-24">
      <h2 className="font-mono text-[11px] font-medium tracking-[0.18em] text-accent-hover uppercase">
        Your bar
      </h2>
      <dl className="mt-8 divide-y divide-hairline border-y border-hairline">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5">
            <dt className="font-mono text-[11px] font-medium tracking-[0.14em] text-text-secondary uppercase">
              {label}
            </dt>
            <dd className="font-serif text-[22px] leading-tight text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <Link
        href="/account/settings"
        className="mt-6 inline-flex min-h-11 items-center font-mono text-[11px] font-medium tracking-[0.14em] text-accent-hover uppercase underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      >
        Change in settings
      </Link>
    </div>
  );
}
