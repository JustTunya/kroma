import Link from "next/link";
import { redirect } from "next/navigation";

import { BehindTheBar } from "@/components/dashboard/numbers/BehindTheBar";
import { FilterRail } from "@/components/dashboard/numbers/FilterRail";
import { Ledger } from "@/components/dashboard/numbers/Ledger";
import { MetaLine } from "@/components/dashboard/numbers/MetaLine";
import { ServiceTape } from "@/components/dashboard/numbers/ServiceTape";
import { actionsFor, euros, readRange, shopDayKey } from "@/lib/manage";
import { createClient } from "@/lib/server";
import { currentActor, roster } from "@/lib/staff";
import { staffCan } from "@/lib/staff-permissions";

import type { BarStat, Earnings, LedgerEntry } from "@/types/manage";

export const metadata = {
  title: "The numbers — KROMA",
  robots: { index: false, follow: false },
};

// Money that moved four seconds ago is the reason anyone opens this mid-service.
export const dynamic = "force-dynamic";

const PER_PAGE = 50;

export default async function NumbersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const actor = await currentActor();
  // Two different failures, two different destinations. A locked terminal
  // needs a PIN; a barista who found the URL needs the pass back, not a 403
  // telling them there is a page here worth trying again for.
  if (!actor) redirect("/dashboard/unlock");
  if (!staffCan(actor.role, "analytics.view")) redirect("/dashboard/board");

  const today = shopDayKey();
  const range = readRange({ from: one("from"), to: one("to") }, today);
  const categories = (one("cat") ?? "").split(",").filter(Boolean);
  const staffId = one("staff") ?? null;
  const page = Math.max(0, Number.parseInt(one("page") ?? "0", 10) || 0);

  const supabase = await createClient();
  const span = {
    p_actor: actor.staffId,
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  };

  const [earned, bar, ledger, stock, people] = await Promise.all([
    supabase.rpc("manage_earnings", span),
    supabase.rpc("manage_bar", span),
    supabase.rpc("manage_ledger", {
      ...span,
      p_staff: staffId ?? undefined,
      p_actions: actionsFor(categories) ?? undefined,
      // One over the page, so "Older" appears only when there is an older.
      p_limit: PER_PAGE + 1,
      p_offset: page * PER_PAGE,
    }),
    // The 86 panel is its own read rather than a filter of the one above: the
    // manager's category pills must not be able to empty it.
    supabase.rpc("manage_ledger", {
      ...span,
      p_actions: ["item.86"],
      p_limit: 40,
    }),
    roster(),
  ]);

  // A read that FAILED and a morning where nothing sold both arrive here as a
  // null. Drawing €0.00 for the first one is the worst thing this page could
  // do: it is a confident, wrong answer about money, and it looks exactly like
  // a true one. So a failed read stops the page instead of filling it in.
  const broken = [earned.error, bar.error, ledger.error, stock.error].find(Boolean);

  const take = (earned.data as Earnings | null) ?? EMPTY;
  const staff = (bar.data as BarStat[] | null) ?? [];
  const rows = (ledger.data as LedgerEntry[] | null) ?? [];
  const entries = rows.slice(0, PER_PAGE);

  // Stock going to zero is what ran out. The same action also records a
  // morning's bake count being set, which is not news.
  const ranOut = ((stock.data as LedgerEntry[] | null) ?? []).filter(
    (entry) => entry.detail?.to === 0 && entry.item_name,
  );

  const query = new URLSearchParams(
    Object.entries({
      from: range.fromKey,
      to: range.toKey,
      cat: categories.join(","),
      staff: staffId ?? "",
    }).filter(([, value]) => value),
  ).toString();

  const lost = take.voided + take.refunded;
  // The shop day of the newest order anywhere, for the empty-window pointer.
  const lastDay = take.latest ? shopDayKey(new Date(take.latest)) : null;

  const header = (
    <header className="px-5 pt-10 pb-9 sm:px-10 lg:px-14">
      <h1 className="font-serif text-[clamp(36px,5vw,64px)] leading-[1.05] tracking-[-0.02em]">
        The numbers
      </h1>
    </header>
  );

  if (broken) {
    return (
      <>
        {header}
        <section
          aria-label="The numbers could not be read"
          className="px-5 py-16 sm:px-10 lg:px-14"
        >
          <p
            role="status"
            className="border-y border-kds-border py-6 font-mono text-[11px] leading-[1.7] tracking-[0.14em] text-badge-alert uppercase"
          >
            The numbers could not be read. Nothing is lost — the till and the
            pass are unaffected.
          </p>
          <p className="mt-6 max-w-lg font-sans text-[15px] leading-[1.6] text-kds-text-secondary">
            The database refused the request. Whoever looks after the server
            needs the line below.
          </p>
          <p className="mt-4 font-mono text-[11px] leading-[1.7] tracking-[0.02em] text-kds-text-secondary">
            {broken.code ? `${broken.code} — ` : ""}
            {broken.message}
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      {header}

      <FilterRail
        range={range}
        staff={people}
        today={today}
        categories={categories}
        staffId={staffId}
      />

      <Section eyebrow="The take" heading="What came in">
        <p className="font-serif text-[clamp(48px,8vw,96px)] leading-[0.95] tracking-[-0.03em] tabular-nums">
          {money(take.taken)}
        </p>

        {take.orders === 0 && lastDay && lastDay !== range.toKey ? (
          // €0.00 is the truth, but on its own it reads as a broken page. The
          // shop has takings, just not in this window — say which day has them
          // and make it one tap, rather than leaving a manager to guess.
          <div className="mt-6">
            <p className="max-w-lg font-sans text-[15px] leading-[1.6] text-kds-text-secondary">
              Nothing came in {range.days > 1 ? "in this window" : "on this day"}.
              The last order was {rangeLabel(lastDay, lastDay, today)}.
            </p>
            <Link
              href={`?from=${lastDay}&to=${lastDay}`}
              className="mt-5 inline-flex h-9 items-center rounded-full border border-kds-border px-4 font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase transition-colors hover:border-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              Show {rangeLabel(lastDay, lastDay, today)}
            </Link>
          </div>
        ) : (
          <MetaLine
            className="mt-6"
            parts={[
              { text: `${take.orders} ${take.orders === 1 ? "order" : "orders"}` },
              { text: `${money(take.average)} average` },
              { text: `${money(take.online)} online` },
              { text: `${money(take.counter)} counter` },
            ]}
          />
        )}

        <div className="mt-10 grid gap-x-14 gap-y-8 border-t border-kds-border pt-8 md:grid-cols-2">
          <div>
            <h3 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
              Money that left again
            </h3>
            <p className="mt-3 font-mono text-[22px] font-medium tabular-nums">
              <span className={lost > 0 ? "text-badge-alert" : undefined}>
                {money(lost)}
              </span>
            </p>
            <MetaLine
              className="mt-3 text-kds-text-secondary"
              parts={[
                { text: `${money(take.voided)} voided` },
                { text: `${money(take.refunded)} refunded` },
                ...(take.unpaid > 0
                  ? [
                      {
                        text: `${take.unpaid} still unpaid on the pass`,
                        tone: "text-accent-primary",
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          <div className="md:border-l md:border-kds-border md:pl-14">
            <h3 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
              Made and binned
            </h3>
            <p className="mt-3 font-mono text-[22px] font-medium tabular-nums">
              <span className={take.abandoned > 0 ? "text-badge-alert" : undefined}>
                {money(take.abandoned)}
              </span>
            </p>
            {/* The distinction the schema went to the trouble of encoding: the
                till kept this money and the coffee still went in the bin. */}
            <p className="mt-3 max-w-md font-sans text-[15px] leading-[1.55] text-kds-text-secondary">
              Paid for, made, and nobody came for it. The money stayed —
              this is milk and beans, not a lost sale.
            </p>
          </div>
        </div>
      </Section>

      <Section eyebrow="Through the day" heading="When it came, who was there">
        <ServiceTape hours={take.by_hour} days={range.days} />
      </Section>

      <Section eyebrow="Behind the bar" heading="Who was on it">
        <BehindTheBar people={staff} />
      </Section>

      <Section eyebrow="Off the shelf" heading="What sold, what ran out">
        <div className="grid gap-x-14 gap-y-12 md:grid-cols-2">
          <div>
            <h3 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
              Best sellers
            </h3>
            {take.items.length === 0 ? (
              <p className="mt-6 border-y border-kds-border py-10 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
                Nothing went out in this window.
              </p>
            ) : (
              <ol className="mt-6 divide-y divide-kds-border border-y border-kds-border">
                {take.items.slice(0, 8).map((item) => (
                  <li
                    key={item.name}
                    className="flex items-baseline justify-between gap-6 py-4"
                  >
                    <span className="min-w-0 truncate font-serif text-[20px] leading-[1.2] tracking-[-0.02em]">
                      <span className="mr-2 font-mono text-[11px] text-kds-text-secondary tabular-nums">
                        {item.qty}×
                      </span>
                      {item.name}
                    </span>
                    <span className="shrink-0 font-mono text-[13px] tabular-nums">
                      {euros(item.revenue)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="md:border-l md:border-kds-border md:pl-14">
            <h3 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
              Gone before close
            </h3>
            {ranOut.length === 0 ? (
              <p className="mt-6 border-y border-kds-border py-10 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
                Nothing ran out.
              </p>
            ) : (
              <ul className="mt-6 divide-y divide-kds-border border-y border-kds-border">
                {ranOut.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-baseline justify-between gap-6 py-4"
                  >
                    <span className="min-w-0 truncate font-serif text-[20px] leading-[1.2] tracking-[-0.02em]">
                      {entry.item_name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase tabular-nums">
                      {new Date(entry.created_at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-5 max-w-md font-sans text-[15px] leading-[1.55] text-kds-text-secondary">
              Anything gone before mid-afternoon is a bake to grow, not a
              stock-out to apologise for.
            </p>
          </div>
        </div>
      </Section>

      <Section eyebrow="The ledger" heading="Everything that happened" last>
        <Ledger
          entries={entries}
          page={page}
          perPage={PER_PAGE}
          more={rows.length > PER_PAGE}
          showDate={range.days > 1}
          query={query}
        />
      </Section>
    </>
  );
}

/** Every block on the page: eyebrow, serif heading, content, one hairline. */
function Section({
  eyebrow,
  heading,
  last,
  children,
}: {
  eyebrow: string;
  heading: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={eyebrow}
      className={`px-5 py-16 sm:px-10 lg:px-14 lg:py-24 ${last ? "pb-24 lg:pb-32" : "border-b border-kds-border"}`}
    >
      <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-4 max-w-[14ch] font-serif text-[clamp(28px,3.4vw,44px)] leading-[1.05] tracking-[-0.02em]">
        {heading}
      </h2>
      <div className="mt-10">{children}</div>
    </section>
  );
}

/**
 * Takings, grouped. The storefront's rule is a bare `€1284.60` because a price
 * is never four digits; a month behind the bar is, and a headline number you
 * have to count the digits of is not a headline.
 */
function money(amount: number): string {
  return `€${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function rangeLabel(from: string, to: string, today: string): string {
  const day = (key: string) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
    });

  if (from === to) return to === today ? "Today, so far" : day(to);
  return `${day(from)} — ${day(to)}`;
}

const EMPTY: Earnings = {
  taken: 0,
  orders: 0,
  average: 0,
  online: 0,
  counter: 0,
  voided: 0,
  refunded: 0,
  abandoned: 0,
  unpaid: 0,
  latest: null,
  by_hour: [],
  items: [],
};
