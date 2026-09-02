import { redirect } from "next/navigation";

import { DayReport } from "@/components/dashboard/day/DayReport";
import { MetaLine } from "@/components/dashboard/numbers/MetaLine";
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
        <>
          <section
            aria-label="Since open"
            className="px-5 py-16 sm:px-10 lg:px-14 lg:py-24"
          >
            <p className="font-mono text-[10px] font-medium tracking-[0.18em] text-accent-primary uppercase">
              Since open
            </p>
            <h2 className="mt-4 max-w-[14ch] font-serif text-[clamp(28px,3.4vw,44px)] leading-[1.05] tracking-[-0.02em]">
              What&rsquo;s moved today
            </h2>

            <p className="mt-10 font-serif text-[clamp(48px,8vw,96px)] leading-[0.95] tracking-[-0.03em] tabular-nums">
              {orders.count ?? 0}
            </p>
            <MetaLine
              className="mt-6 text-kds-text-secondary"
              parts={[
                { text: orders.count === 1 ? "Order today" : "Orders today" },
                { text: `Opened ${clock(day.opened_at)}${openedByName ? ` by ${openedByName}` : ""}` },
              ]}
            />

            <div className="mt-10 border-t border-kds-border pt-8">
              <h3 className="font-mono text-[10px] font-medium tracking-[0.18em] text-kds-text-secondary uppercase">
                On the counter
              </h3>
              {onCounter.data && onCounter.data.length > 0 ? (
                <ul className="mt-6 divide-y divide-kds-border border-y border-kds-border">
                  {onCounter.data.map((item) => (
                    <li
                      key={item.name}
                      className="flex items-baseline justify-between gap-6 py-4"
                    >
                      <span className="font-serif text-[20px] leading-[1.2] tracking-[-0.02em]">
                        {item.name}
                      </span>
                      <span
                        className={
                          (item.daily_stock ?? 0) <= 5
                            ? "shrink-0 font-mono text-[11px] tracking-[0.14em] text-badge-alert uppercase tabular-nums"
                            : "shrink-0 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase tabular-nums"
                        }
                      >
                        {item.daily_stock} left
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-6 border-y border-kds-border py-10 font-mono text-[11px] tracking-[0.14em] text-kds-text-secondary uppercase">
                  Nothing on the counter.
                </p>
              )}
            </div>
          </section>

          {reportBroken ? (
            <section
              aria-label="The till"
              className="border-t border-kds-border px-5 py-16 sm:px-10 lg:px-14 lg:py-24"
            >
              <p
                role="status"
                className="max-w-lg border-y border-kds-border py-6 font-mono text-[11px] leading-[1.7] tracking-[0.14em] text-badge-alert uppercase"
              >
                The takings could not be read. Nothing is lost — the till is
                unaffected.
              </p>
            </section>
          ) : (
            report.data && <DayReport report={report.data as Report} canClose={canClose} />
          )}
        </>
      ) : (
        <p className="mx-5 border-y border-kds-border py-10 font-mono text-[13px] tracking-[0.02em] text-kds-text-secondary sm:mx-10 lg:mx-14">
          The shop has not opened today.
        </p>
      )}
    </>
  );
}
