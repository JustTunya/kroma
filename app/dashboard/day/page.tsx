import Link from "next/link";
import { redirect } from "next/navigation";

import { DayReport } from "@/components/dashboard/day/DayReport";
import { dayLabel } from "@/lib/service-day";
import { createClient } from "@/lib/server";
import { currentActor, currentDay } from "@/lib/staff";
import { staffCan } from "@/lib/staff-permissions";
import type { DayReport as Report } from "@/types/day";

export const metadata = {
  title: "The day — KROMA",
  robots: { index: false, follow: false },
};

// Stock and the order count move all morning.
export const dynamic = "force-dynamic";

export default async function DayPage() {
  const actor = await currentActor();
  if (!actor) redirect("/dashboard/unlock");

  const day = await currentDay();
  const supabase = await createClient();
  const canClose = staffCan(actor.role, "shop.close");

  const [orders, staff, onCounter, report] = await Promise.all([
    day
      ? supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("service_day", day.day)
      : Promise.resolve({ count: 0 }),
    day?.opened_by
      ? supabase.from("staff").select("display_name").eq("id", day.opened_by).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("menu_items")
      .select("name, daily_stock")
      .gt("daily_stock", 0)
      .order("name"),
    // A barista sees the day's state and the leftover stock, never the
    // takings — matching how /dashboard/numbers is already gated.
    day && canClose
      ? supabase.rpc("service_report", { p_actor: actor.staffId, p_day: day.day })
      : Promise.resolve({ data: null, error: null }),
  ]);

  const openedByName = staff.data?.display_name ?? null;
  // A read error must not render as €0.00 — see app/dashboard/numbers/page.tsx.
  const reportBroken = day && canClose && report.error;
  const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <header className="px-5 pt-10 pb-9 sm:px-10 lg:px-14">
        <p
          className={
            day
              ? "font-mono text-[11px] font-medium tracking-[0.18em] text-accent-primary uppercase"
              : "font-mono text-[11px] font-medium tracking-[0.18em] text-badge-alert uppercase"
          }
        >
          {day ? `Service / ${dayLabel(day.day)}` : "Service / Not open"}
        </p>
        <h1 className="mt-2 font-serif text-[clamp(36px,5vw,64px)] leading-[1.05] tracking-[-0.02em]">
          The day
        </h1>
      </header>

      {day ? (
        <section className="px-5 pb-16 sm:px-10 lg:px-14 lg:pb-24">
          <p className="max-w-lg text-[15px] leading-[1.6] text-kds-text-secondary">
            Opened {clock(day.opened_at)}
            {openedByName ? ` by ${openedByName}` : ""}.
          </p>

          <p className="mt-10 font-serif text-[clamp(48px,8vw,96px)] leading-[0.95] tracking-[-0.03em] tabular-nums">
            {orders.count ?? 0}
          </p>
          <p className="mt-3 font-mono text-[11px] font-medium tracking-[0.14em] text-kds-text-secondary uppercase">
            {orders.count === 1 ? "Order today" : "Orders today"}
          </p>

          <div className="mt-10 border-t border-kds-border pt-8">
            <h2 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
              On the counter
            </h2>
            {onCounter.data && onCounter.data.length > 0 ? (
              <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase">
                {onCounter.data.map((item, i) => (
                  <span key={item.name}>
                    {i > 0 && (
                      <span aria-hidden className="mx-3 text-kds-border">
                        /
                      </span>
                    )}
                    {item.name}
                  </span>
                ))}
              </p>
            ) : (
              <p className="mt-4 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
                Nothing on the counter.
              </p>
            )}
          </div>

          {reportBroken ? (
            <p
              role="status"
              className="mt-10 max-w-lg border-y border-kds-border py-6 font-mono text-[11px] leading-[1.7] tracking-[0.14em] text-badge-alert uppercase"
            >
              The takings could not be read. Nothing is lost — the till is
              unaffected.
            </p>
          ) : (
            report.data && <DayReport report={report.data as Report} />
          )}

          {canClose && (
            <Link
              href="/dashboard/day/close"
              className="mt-10 inline-flex h-10 items-center rounded-full bg-accent-primary px-5 font-mono text-[10px] font-medium tracking-[0.18em] text-surface-card uppercase transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kds-text-primary"
            >
              Count the drawer
            </Link>
          )}
        </section>
      ) : (
        <p className="mx-5 border-y border-kds-border py-10 font-mono text-[13px] tracking-[0.02em] text-kds-text-secondary sm:mx-10 lg:mx-14">
          The shop has not opened today.
        </p>
      )}
    </>
  );
}
