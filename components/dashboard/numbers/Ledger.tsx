import Link from "next/link";

import { LEDGER_WORDS, ledgerTone } from "@/lib/manage";
import { cn } from "@/lib/utils";

import type { LedgerEntry } from "@/types/manage";

export function Ledger({
  entries,
  page,
  perPage,
  more,
  showDate,
  query,
}: {
  entries: LedgerEntry[];
  page: number;
  perPage: number;

  more: boolean;

  showDate: boolean;

  query: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="border-y border-kds-border py-10 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
        Nothing happened in this window.
      </p>
    );
  }

  return (
    <>
      <ol className="divide-y divide-kds-border border-y border-kds-border">
        {entries.map((entry) => {
          const at = new Date(entry.created_at);
          const subject =
            entry.order_number !== null
              ? `#${entry.order_number}`
              : (entry.item_name ?? "an item");

          const template = LEDGER_WORDS[entry.action] ?? entry.action;
          const said = template.replace("%s", subject);
          const href = entry.order_number !== null ? `/dashboard/order/${entry.subject_id}` : null;

          const body = (
            <>
              <time
                dateTime={entry.created_at}
                className="w-[4.5rem] shrink-0 font-mono text-[11px] tracking-[0.02em] text-kds-text-secondary tabular-nums"
              >
                {at.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {showDate && (
                  <span className="block text-[10px] text-kds-border">
                    {at.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                )}
              </time>

              <p className="min-w-0 flex-1 font-sans text-[15px] leading-[1.55]">
                <span className="text-kds-text-primary">
                  {entry.staff_name ?? "Someone since removed"}
                </span>{" "}
                <span className={ledgerTone(entry.action)}>{said}</span>
                {typeof entry.detail?.note === "string" && (
                  <span className="mt-1 block text-kds-text-secondary italic">
                    “{entry.detail.note as string}”
                  </span>
                )}
              </p>

              {entry.station_name && (
                <span className="hidden shrink-0 self-start font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase sm:block">
                  {entry.station_name}
                </span>
              )}
            </>
          );

          return (
            <li key={entry.id} title={entry.action}>
              {href ? (
                <Link
                  href={href}
                  className={cn(
                    "flex gap-5 py-4 transition-colors hover:bg-kds-surface",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kds-text-primary",
                  )}
                >
                  {body}
                </Link>
              ) : (
                <div className="flex gap-5 py-4">{body}</div>
              )}
            </li>
          );
        })}
      </ol>

      {(page > 0 || more) && (
        <nav
          aria-label="Ledger pages"
          className="flex items-center gap-6 pt-6 font-mono text-[10px] font-medium tracking-[0.18em] uppercase"
        >
          {page > 0 && (
            <PageLink query={query} page={page - 1}>
              ← Newer
            </PageLink>
          )}
          <span className="text-kds-text-secondary tabular-nums">
            {page * perPage + 1}–{page * perPage + entries.length}
          </span>
          {more && (
            <PageLink query={query} page={page + 1}>
              Older →
            </PageLink>
          )}
        </nav>
      )}
    </>
  );
}

function PageLink({
  query,
  page,
  children,
}: {
  query: string;
  page: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`?${query}${query ? "&" : ""}page=${page}`}
      scroll={false}
      className="text-kds-text-secondary transition-colors hover:text-kds-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
    >
      {children}
    </Link>
  );
}
