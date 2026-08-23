"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { refundOrder } from "@/lib/refund";
import { createClient } from "@/lib/server";
import { currentActor, currentStaff, requireActor } from "@/lib/staff";
import {
  ACTOR_COOKIE,
  ACTOR_TTL_MS,
  actorSecret,
  signActor,
} from "@/lib/staff-session";

import type { OrderStatus } from "@/lib/order-status";
import type { StaffRole } from "@/lib/staff-permissions";

export type Result = { ok: boolean; error?: string };

/** Anything the RPC raises is already worded for a person. Pass it through. */
function fail(error: unknown): Result {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  return { ok: false, error: message };
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  // Scoped to the dashboard: the storefront has no business carrying it.
  path: "/dashboard",
  maxAge: ACTOR_TTL_MS / 1000,
} as const;

/** Fifteen minutes from the last thing you did, not from when you unlocked. */
async function slide(actor: { staffId: string; role: StaffRole; name: string }) {
  const store = await cookies();
  store.set(
    ACTOR_COOKIE,
    signActor({ ...actor, exp: Date.now() + ACTOR_TTL_MS }, actorSecret()),
    COOKIE_OPTIONS,
  );
}

/**
 * Roster pick plus PIN buys fifteen minutes of write access. The PIN is posted
 * here and verified inside staff_unlock(); it is never compared in this file
 * and never logged.
 */
export async function unlockAction(
  staffId: string,
  pin: string,
): Promise<Result> {
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: "Four digits." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_unlock", {
    p_staff_id: staffId,
    p_pin: pin,
  });

  if (error) return fail(error);

  const result = data as {
    ok: boolean;
    reason?: string;
    staff_id?: string;
    role?: StaffRole;
    display_name?: string;
  };

  if (!result.ok) {
    return {
      ok: false,
      // Deliberately the same wording for a wrong PIN and an unknown row: the
      // roster is already public to staff, but the error should not confirm
      // which names carry a working PIN.
      error:
        result.reason === "locked"
          ? "Locked for 15 minutes. Ask the owner."
          : "That PIN is not right.",
    };
  }

  const store = await cookies();
  store.set(
    ACTOR_COOKIE,
    signActor(
      {
        staffId: result.staff_id!,
        role: result.role!,
        name: result.display_name!,
        exp: Date.now() + ACTOR_TTL_MS,
      },
      actorSecret(),
    ),
    COOKIE_OPTIONS,
  );

  return { ok: true };
}

/** Hand the terminal back. The station session stays; only the person leaves. */
export async function lockAction(): Promise<void> {
  const store = await cookies();
  store.delete(ACTOR_COOKIE);
  revalidatePath("/dashboard", "layout");
}

/**
 * The two ends of a shift, stamped in staff_events.
 *
 * No requireActor(): there is no `shift.*` in staff_can because there is
 * nothing to gate. Holding a valid PIN cookie is the whole permission, and it
 * only ever marks your own row — shift_mark() takes the actor from here, not
 * from an argument the client could choose.
 */
export async function startShiftAction(): Promise<Result> {
  return markShift(true);
}

/** Ends the shift and hands the terminal back in one tap. */
export async function endShiftAction(): Promise<Result> {
  const result = await markShift(false);
  if (result.ok) await lockAction();
  return result;
}

async function markShift(open: boolean): Promise<Result> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Unlock with your PIN first." };

  const station = await currentStaff();
  const supabase = await createClient();

  const { error } = await supabase.rpc("shift_mark", {
    p_staff_id: actor.staffId,
    p_open: open,
    p_station: station?.id,
  });
  if (error) return fail(error);

  await slide(actor);
  revalidatePath("/dashboard/board");
  return { ok: true };
}

/**
 * One transition. advance_order() owns the rules — this only carries the actor
 * and the station, and re-signs the cookie so an active shift slides forward.
 */
export async function advanceOrderAction(
  orderId: string,
  to: OrderStatus,
): Promise<Result> {
  try {
    // 'order.advance' is the floor. The RPC re-derives the real action from the
    // transition and refuses if this actor's role cannot do it, so a void or a
    // refund is still manager-only even though it enters through here.
    const actor = await requireActor("order.advance");
    const station = await currentStaff();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("advance_order", {
      p_order_id: orderId,
      p_to: to,
      p_actor: actor.staffId,
      p_station: station?.id,
    });
    if (error) return fail(error);

    await slide(actor);
    revalidatePath("/dashboard/board");
    revalidatePath(`/dashboard/order/${orderId}`);

    // The transition is already committed. Only the money is still open, so a
    // failure here is reported as a failure of the refund and not of the void —
    // the order really has moved, and the board will show it.
    if ((data as { refund_owed?: boolean } | null)?.refund_owed) {
      const refund = await refundOrder(orderId);
      if (!refund.ok) return { ok: false, error: refund.error };
    }

    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** 0 is the 86 button; a number is the bake count; null is unlimited. */
export async function setStockAction(
  itemId: string,
  stock: number | null,
): Promise<Result> {
  try {
    const actor = await requireActor("item.86");
    const station = await currentStaff();
    const supabase = await createClient();

    const { error } = await supabase.rpc("set_item_stock", {
      p_item_id: itemId,
      p_actor: actor.staffId,
      // Omitted means unlimited, matching what a null daily_stock already
      // means for espresso-bar drinks.
      p_stock: stock ?? undefined,
      p_station: station?.id,
    });
    if (error) return fail(error);

    await slide(actor);
    revalidatePath("/dashboard/board");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Appends to the order's note.
 *
 * Goes through note_order() rather than an UPDATE, because staff have no
 * update policy on orders and staff_events has no insert policy at all — both
 * deliberate. A direct write from here would have silently touched zero rows.
 *
 * The length checks are duplicated in the RPC. These two exist to save a round
 * trip; the ones in SQL are the enforcement.
 */
export async function noteOrderAction(
  orderId: string,
  note: string,
): Promise<Result> {
  const trimmed = note.trim();
  if (!trimmed) return { ok: false, error: "Nothing to add." };
  if (trimmed.length > 280) return { ok: false, error: "Keep it under 280." };

  try {
    const actor = await requireActor("order.note");
    const station = await currentStaff();
    const supabase = await createClient();

    const { error } = await supabase.rpc("note_order", {
      p_order_id: orderId,
      p_note: trimmed,
      p_actor: actor.staffId,
      p_station: station?.id,
    });
    if (error) return fail(error);

    await slide(actor);
    revalidatePath(`/dashboard/order/${orderId}`);
    revalidatePath("/dashboard/board");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
