"use server";

import { revalidatePath } from "next/cache";

import { refundOrder } from "@/lib/refund";
import { createClient } from "@/lib/server";

import type { OrderStatus } from "@/lib/order-status";

/**
 * `status` is what the order actually landed on, which is not the same as
 * `ok`: a refund that fails still leaves a cancelled order, and the page must
 * show that rather than the lane it came from.
 */
export type CancelResult = {
  ok: boolean;
  status?: OrderStatus;
  error?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "I ordered that by accident."
 *
 * The token is the guest's whole credential, same as it is for the page itself.
 * cancel_order_by_token() owns every rule — which statuses may still be dropped,
 * the stock it hands back, the audit row — and refuses anything a barista has
 * already started. Nothing is decided here.
 */
export async function cancelOwnOrderAction(token: string): Promise<CancelResult> {
  // Guard before the RPC: a non-uuid raises 22P02 rather than a worded error.
  if (!UUID.test(token)) return { ok: false, error: "That order is not ours." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_order_by_token", {
    p_token: token,
  });

  // Whatever the RPC raises is already worded for a person.
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/order/${token}`);

  const result = data as { id: string; refund_owed: boolean } | null;
  if (result?.refund_owed) {
    const refund = await refundOrder(result.id);
    if (!refund.ok) {
      // The order is off the pass either way. What the customer needs to hear
      // is that the money is not back yet, not the Stripe wording staff get.
      return {
        ok: false,
        status: "cancelled",
        error: "Cancelled. The refund needs a hand — ask at the bar.",
      };
    }
  }

  return { ok: true, status: "cancelled" };
}
