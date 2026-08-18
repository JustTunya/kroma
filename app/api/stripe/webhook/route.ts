import type Stripe from "stripe";

import { admin } from "@/lib/admin";
import { stripe } from "@/lib/stripe";

/**
 * The only thing in this codebase that means "paid".
 *
 * Both transitions are guarded by `status = 'pending'`, which IS the
 * idempotency — a replayed event is a no-op, so no event ledger exists.
 * Never return 500 for a business-logic problem: Stripe retries for three days.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("missing signature", { status: 400 });
  }

  // Raw body. request.json() would reformat it and break the HMAC.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error("stripe signature rejected:", error);
    return new Response("invalid signature", { status: 400 });
  }

  const db = admin();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // `completed` alone does not mean money moved — asynchronous methods land
    // here unpaid. Only payment_status settles it.
    if (session.payment_status !== "paid") {
      return new Response("ok");
    }

    const orderId = session.metadata?.order_id;
    if (!orderId) {
      console.error("checkout.session.completed with no order_id");
      return new Response("ok");
    }

    const { error } = await db
      .from("orders")
      .update({
        status: "paid",
        expires_at: null,
        stripe_payment_intent_id:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
      })
      .eq("id", orderId)
      .eq("status", "pending");

    if (error) console.error("order paid update failed:", error.message);
  }

  if (event.type === "checkout.session.expired") {
    const orderId = event.data.object.metadata?.order_id;
    if (orderId) {
      const { error } = await db.rpc("release_order", { p_order_id: orderId });
      if (error) console.error("release_order failed:", error.message);
    }
  }

  return new Response("ok");
}
