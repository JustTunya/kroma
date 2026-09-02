import "server-only";
import type Stripe from "stripe";

import { admin } from "@/lib/admin";
import { unpackItems } from "@/lib/checkout";
import { sendReceipt } from "@/lib/send-receipt";
import { stripe } from "@/lib/stripe";

export type SessionOutcome =
  | { status: "placed"; token: string }
  | { status: "unpaid" }
  | { status: "refunded" };

/**
 * Turns a paid Stripe session into the order. Nothing else creates a card
 * order, so an unpaid card is not an order in any state — there is no pending
 * row to clean up, and the customer can simply come back and try again.
 *
 * Called by the webhook and by /checkout/confirm, in whichever order they
 * arrive. The unique index on stripe_session_id settles the race: the loser
 * gets 23505 and reads back the row the winner wrote.
 */
export async function placeOrderFromSession(
  session: Stripe.Checkout.Session,
): Promise<SessionOutcome> {
  // The one line that means money moved. `complete` alone does not.
  if (session.payment_status !== "paid") return { status: "unpaid" };

  const db = admin();
  const placed = await db
    .from("orders")
    .select("access_token")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (placed.data) return { status: "placed", token: placed.data.access_token };

  const items = unpackItems(session.metadata);
  if (!items) {
    return refund(session, "paid session carries no readable cart");
  }

  const { data, error } = await db.rpc("create_order", {
    p_items: items,
    p_customer_name: session.metadata?.customer_name ?? "",
    p_notes: session.metadata?.notes ?? "",
    p_payment_method: "online",
    p_user_id: session.metadata?.user_id || undefined,
    p_stripe_session_id: session.id,
    p_stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : undefined,
    p_receipt_email: session.metadata?.receipt_email || undefined,
  });

  if (!error && data) {
    // Fire-and-forget: a receipt must never block the pass.
    void sendReceipt(data.id).catch(console.error);
    return { status: "placed", token: data.access_token };
  }

  // The other caller got there first between the read above and this insert.
  if (error?.code === "23505") {
    const raced = await db
      .from("orders")
      .select("access_token")
      .eq("stripe_session_id", session.id)
      .maybeSingle();
    if (raced.data) return { status: "placed", token: raced.data.access_token };
  }

  // Stock is no longer held while the customer is at Stripe, so the last bun
  // can go between the quote and the payment. We are holding their money and
  // have no order to give them: hand it straight back.
  return refund(session, error?.message ?? "create_order returned nothing");
}

async function refund(
  session: Stripe.Checkout.Session,
  reason: string,
): Promise<SessionOutcome> {
  console.error("order could not be placed after payment:", reason);

  const intent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!intent) {
    console.error("no payment intent on", session.id, "— refund by hand");
    return { status: "refunded" };
  }

  try {
    // Keyed on the session so a webhook retry cannot refund twice.
    await stripe.refunds.create(
      { payment_intent: intent },
      { idempotencyKey: `refund_${session.id}` },
    );
  } catch (error) {
    console.error("refund failed for", intent, "— settle by hand:", error);
  }

  return { status: "refunded" };
}
