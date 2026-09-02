import type Stripe from "stripe";

import { placeOrderFromSession } from "@/lib/payment";
import { getStripe } from "@/lib/stripe";

/**
 * Where a paid session becomes an order — normally first, but /checkout/confirm
 * does the same work from the browser side, and placeOrderFromSession() is
 * idempotent on the unique stripe_session_id, so either order of arrival ends
 * with exactly one order. No event ledger is needed.
 *
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
    event = getStripe().webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error("stripe signature rejected:", error);
    return new Response("invalid signature", { status: 400 });
  }

  // checkout.session.expired needs no handler any more: an abandoned card
  // payment never created an order and never took stock, so there is nothing
  // to hand back.
  if (event.type === "checkout.session.completed") {
    await placeOrderFromSession(event.data.object);
  }

  return new Response("ok");
}
