import "server-only";

import { admin } from "@/lib/admin";
import { getStripe } from "@/lib/stripe";

export type RefundResult = { ok: boolean; error?: string };

export async function refundOrder(orderId: string, amountEuros?: number): Promise<RefundResult> {
  const { data, error } = await admin()
    .from("orders")
    .select("stripe_payment_intent_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    console.error("refund lookup failed for order", orderId, error?.message);
    return { ok: false, error: "The payment could not be found — settle it in Stripe." };
  }

  if (!data.stripe_payment_intent_id) return { ok: true };

  const cents =
    amountEuros !== undefined ? Math.round(amountEuros * 100) : undefined;

  try {
    await getStripe().refunds.create(
      {
        payment_intent: data.stripe_payment_intent_id,
        ...(cents !== undefined && { amount: cents }),
      },

      { idempotencyKey: `refund_${orderId}_${cents ?? "all"}` },
    );
    return { ok: true };
  } catch (stripeError) {
    console.error("refund failed for order", orderId, stripeError);
    return { ok: false, error: "The refund did not go through — settle it in Stripe." };
  }
}
