import "server-only";
import type Stripe from "stripe";

import { admin } from "@/lib/admin";
import { unpackItems } from "@/lib/checkout";
import { sendReceipt } from "@/lib/send-receipt";
import { getStripe } from "@/lib/stripe";

export type SessionOutcome =
  | { status: "placed"; token: string }
  | { status: "unpaid" }
  | { status: "refunded" };

export async function placeOrderFromSession(
  session: Stripe.Checkout.Session,
): Promise<SessionOutcome> {

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

    void sendReceipt(data.id).catch(console.error);
    return { status: "placed", token: data.access_token };
  }

  if (error?.code === "23505") {
    const raced = await db
      .from("orders")
      .select("access_token")
      .eq("stripe_session_id", session.id)
      .maybeSingle();
    if (raced.data) return { status: "placed", token: raced.data.access_token };
  }

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

    await getStripe().refunds.create(
      { payment_intent: intent },
      { idempotencyKey: `refund_${session.id}` },
    );
  } catch (error) {
    console.error("refund failed for", intent, "— settle by hand:", error);
  }

  return { status: "refunded" };
}
