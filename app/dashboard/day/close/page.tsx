import { redirect } from "next/navigation";

import { CashCount } from "@/components/dashboard/day/CashCount";
import { dayLabel } from "@/lib/service-day";
import { createClient } from "@/lib/server";
import { currentActor, currentDay } from "@/lib/staff";
import { staffCan } from "@/lib/staff-permissions";
import type { DayReport } from "@/types/day";

export const metadata = {
  title: "Count the drawer — KROMA",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CloseServicePage() {
  const actor = await currentActor();
  if (!actor) redirect("/dashboard/unlock");
  if (!staffCan(actor.role, "shop.close")) redirect("/dashboard/day");

  const day = await currentDay();
  if (!day) redirect("/dashboard/day");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("service_report", {
    p_actor: actor.staffId,
    p_day: day.day,
  });

  return (
    <>
      <header className="px-5 pt-10 pb-9 sm:px-10 lg:px-14">
        <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-accent-primary uppercase">
          Count the drawer / {dayLabel(day.day)}
        </p>
        <h1 className="mt-2 font-serif text-[clamp(36px,5vw,64px)] leading-[1.05] tracking-[-0.02em]">
          Count the drawer
        </h1>
      </header>

      <section className="px-5 pb-20 sm:px-10 lg:px-14 lg:pb-28">
        {error || !data ? (
          <p
            role="status"
            className="max-w-lg border-y border-kds-border py-6 font-mono text-[11px] leading-[1.7] tracking-[0.14em] text-badge-alert uppercase"
          >
            The takings could not be read. Nothing is lost — the till is
            unaffected.
          </p>
        ) : (
          <CashCount report={data as DayReport} />
        )}
      </section>
    </>
  );
}
