import { OrderBoard } from "@/components/dashboard/OrderBoard";
import { createClient } from "@/lib/server";
import { currentActor, currentDay, currentShift } from "@/lib/staff";

import type { BoardOrder } from "@/types/board";
import type { ParItem } from "@/lib/service-day";

// Live by definition. There is nothing here worth caching for even a second.
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const supabase = await createClient();
  const [{ data }, actor, { data: par }] = await Promise.all([
    supabase.rpc("staff_board"),
    currentActor(),
    // Only batch items. Espresso-bar drinks are unlimited and are stated once
    // on the opening screen rather than listed as sixteen disabled fields.
    supabase
      .from("menu_items")
      .select("id, name, par_stock")
      .eq("is_active", true)
      .not("par_stock", "is", null)
      .order("sort_order"),
  ]);

  // Whether this person is mid-shift, not whether this browser has seen the
  // overlay: a reload during service must not ask them to start again. Shared
  // with the header's End-the-shift button through the per-request cache.
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
