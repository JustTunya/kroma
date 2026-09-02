"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { COOKIE_OPTIONS, fail, slide, type Result } from "@/lib/dashboard-actions";
import { notifyReady } from "@/lib/push";
import { refundOrder } from "@/lib/refund";
import { sendReceipt } from "@/lib/send-receipt";
import { createClient } from "@/lib/server";
import { currentActor, currentStaff, requireActor } from "@/lib/staff";
import { ACTOR_COOKIE, ACTOR_TTL_MS, actorSecret, signActor } from "@/lib/staff-session";

import type { OrderStatus } from "@/lib/order-status";
import type { StaffRole } from "@/lib/staff-permissions";

export type { Result };

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

export async function lockAction(): Promise<void> {
  const store = await cookies();
  store.delete(ACTOR_COOKIE);
  revalidatePath("/dashboard", "layout");
}

export async function startShiftAction(): Promise<Result> {
  return markShift(true);
}

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

export async function advanceOrderAction(
  orderId: string,
  to: OrderStatus,

  tender?: "cash" | "card",
): Promise<Result> {
  try {

    const actor = await requireActor("order.advance");
    const station = await currentStaff();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("advance_order", {
      p_order_id: orderId,
      p_to: to,
      p_actor: actor.staffId,
      p_station: station?.id,
      p_tender: tender,
    });
    if (error) return fail(error);

    await slide(actor);
    revalidatePath("/dashboard/board");
    revalidatePath(`/dashboard/order/${orderId}`);

    if ((data as { refund_owed?: boolean } | null)?.refund_owed) {
      const refund = await refundOrder(orderId);
      if (!refund.ok) return { ok: false, error: refund.error };
    }

    if (to === "paid") void sendReceipt(orderId).catch(console.error);
    if (to === "ready") void notifyReady(orderId).catch(console.error);

    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

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

export async function discountOrderAction(
  orderId: string,
  kind: "percent" | "amount" | "comp",
  value: number,
  reason: string,
): Promise<Result> {
  try {
    const actor = await requireActor("order.discount");
    const station = await currentStaff();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("discount_order", {
      p_order_id: orderId,
      p_actor: actor.staffId,
      p_kind: kind,
      p_value: value,
      p_reason: reason,
      p_station: station?.id,
    });
    if (error) return fail(error);

    await slide(actor);
    revalidatePath("/dashboard/board");
    revalidatePath(`/dashboard/order/${orderId}`);

    const owed = (data as { refund_owed?: number } | null)?.refund_owed ?? 0;
    if (owed > 0) {
      const refund = await refundOrder(orderId, owed);
      if (!refund.ok) return { ok: false, error: refund.error };
    }

    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function openServiceAction(
  counts: Record<string, number>,
): Promise<Result> {
  try {
    const actor = await requireActor("shop.open");
    const supabase = await createClient();

    const { error } = await supabase.rpc("open_service", {
      p_actor: actor.staffId,
      p_stock: Object.keys(counts).length > 0 ? counts : undefined,
    });
    if (error) return fail(error);

    await slide(actor);
    revalidatePath("/dashboard", "layout");

    revalidatePath("/", "page");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function closeServiceAction(
  counted: number,
  detail: Record<string, number>,
): Promise<Result> {
  try {
    const actor = await requireActor("shop.close");
    const supabase = await createClient();

    const { error } = await supabase.rpc("close_service", {
      p_actor: actor.staffId,
      p_counted: counted,
      p_detail: detail,
    });
    if (error) return fail(error);

    await slide(actor);
    revalidatePath("/dashboard", "layout");

    revalidatePath("/", "page");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
