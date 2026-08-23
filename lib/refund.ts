import "server-only";

import { admin } from "@/lib/admin";
import { stripe } from "@/lib/stripe";

export type RefundResult = { ok: boolean; error?: string };

/**
 * Hands the money back for an order the database has already settled.
 *
 * Called only when the RPC says `refund_owed`, and deliberately AFTER it: the
 * `for update` inside advance_order() and cancel_order_by_token() is what makes
 * a double-tapped void impossible to turn into a double refund. The idempotency
 * key is the second belt — a retry of this function is a no-op at Stripe.
 *
 * Reads the payment intent with the service-role client because it is the one
 * column no projection carries: staff_order() and order_by_token() both leave
 * the stripe_* columns out on purpose, and this is the only caller that needs
 * one. That is why admin() is imported here rather than in the actions.
 */
export async function refundOrder(orderId: string): Promise<RefundResult> {
  const { data, error } = await admin()
    .from("orders")
    .select("stripe_payment_intent_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    console.error("refund lookup failed for order", orderId, error?.message);
    return { ok: false, error: "The payment could not be found — settle it in Stripe." };
  }

  // Cash at the counter. The till is the refund; there is nothing to call.
  if (!data.stripe_payment_intent_id) return { ok: true };

  try {
    await stripe.refunds.create(
      { payment_intent: data.stripe_payment_intent_id },
      { idempotencyKey: `refund_${orderId}` },
    );
    return { ok: true };
  } catch (stripeError) {
    console.error("refund failed for order", orderId, stripeError);
    return { ok: false, error: "The refund did not go through — settle it in Stripe." };
  }
}
