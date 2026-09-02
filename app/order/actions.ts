"use server";

import { revalidatePath } from "next/cache";

import { refundOrder } from "@/lib/refund";
import { createClient } from "@/lib/server";

import type { OrderStatus } from "@/lib/order-status";

export type CancelResult = {
  ok: boolean;
  status?: OrderStatus;
  error?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function cancelOwnOrderAction(token: string): Promise<CancelResult> {

  if (!UUID.test(token)) return { ok: false, error: "That order is not ours." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_order_by_token", {
    p_token: token,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/order/${token}`);

  const result = data as { id: string; refund_owed: boolean } | null;
  if (result?.refund_owed) {
    const refund = await refundOrder(result.id);
    if (!refund.ok) {

      return {
        ok: false,
        status: "cancelled",
        error: "Cancelled. The refund needs a hand — ask at the bar.",
      };
    }
  }

  return { ok: true, status: "cancelled" };
}

export type Result = { ok: boolean; error?: string };

export async function subscribeToOrderAction(
  token: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<Result> {
  if (!UUID.test(token)) return { ok: false, error: "That order is not ours." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("subscribe_order_push", {
    p_token: token,
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.keys.p256dh,
    p_auth: subscription.keys.auth,
  });

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "That order can no longer be notified." };
  return { ok: true };
}

export async function setReceiptEmailAction(token: string, email: string): Promise<Result> {
  if (!UUID.test(token)) return { ok: false, error: "That order is not ours." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_receipt_email", {
    p_token: token,
    p_email: email,
  });

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "That order was not found." };
  return { ok: true };
}
