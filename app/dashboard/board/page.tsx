import { OrderBoard } from "@/components/dashboard/OrderBoard";
import { createClient } from "@/lib/server";
import { currentActor } from "@/lib/staff";

import type { BoardOrder } from "@/types/board";

// Live by definition. There is nothing here worth caching for even a second.
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const supabase = await createClient();
  const [{ data }, actor] = await Promise.all([
    supabase.rpc("staff_board"),
    currentActor(),
  ]);

  // Whether this person is mid-shift, not whether this browser has seen the
  // overlay: a reload during service must not ask them to start again.
  const { data: shiftSince } = actor
    ? await supabase.rpc("staff_shift", { p_staff_id: actor.staffId })
    : { data: null };

  return (
    <OrderBoard
      initial={(data as BoardOrder[] | null) ?? []}
      unlocked={Boolean(actor)}
      shiftSince={shiftSince}
    />
  );
}
