import { notFound } from "next/navigation";

import { OrderDetail } from "@/components/dashboard/OrderDetail";
import { createClient } from "@/lib/server";
import { staffCan } from "@/lib/staff-permissions";
import { currentActor } from "@/lib/staff";

import type { BoardOrder } from "@/types/board";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, actor] = await Promise.all([
    supabase.rpc("staff_order", { p_order_id: id }),
    currentActor(),
  ]);

  if (!order) notFound();

  // The audit trail is manager+, matching the RLS policy on staff_events.
  // Asking for it as a barista would come back empty anyway; not asking keeps
  // the page honest about why it is not there.
  const canRead = actor ? staffCan(actor.role, "analytics.view") : false;

  const { data: events } = canRead
    ? await supabase
        .from("staff_events")
        .select("action, created_at, staff:staff_id(display_name)")
        .eq("subject_id", id)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: null };

  return (
    <OrderDetail
      order={order as BoardOrder}
      role={actor?.role ?? null}
      events={events ?? []}
    />
  );
}
