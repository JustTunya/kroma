import { OrderBoard } from "@/components/dashboard/OrderBoard";
import { createClient } from "@/lib/server";
import { currentActor, currentDay, currentShift } from "@/lib/staff";

import type { BoardOrder } from "@/types/board";
import type { ParItem } from "@/lib/service-day";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const supabase = await createClient();
  const [{ data }, actor, { data: par }] = await Promise.all([
    supabase.rpc("staff_board"),
    currentActor(),

    supabase
      .from("menu_items")
      .select("id, name, par_stock")
      .eq("is_active", true)
      .not("par_stock", "is", null)
      .order("sort_order"),
  ]);

  const [shiftSince, day] = await Promise.all([currentShift(), currentDay()]);

  return (
    <OrderBoard
      initial={(data as BoardOrder[] | null) ?? []}
      unlocked={Boolean(actor)}
      shiftSince={shiftSince}
      dayOpen={Boolean(day)}
      par={(par as ParItem[] | null) ?? []}
    />
  );
}
