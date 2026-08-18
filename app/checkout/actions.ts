"use server";

import { headers } from "next/headers";

import type { OrderDoc } from "@/components/checkout/OrderStatus";
import { createClient } from "@/lib/server";
import { stripe } from "@/lib/stripe";
import type { OrderPayloadLine } from "@/lib/checkout";

export type PlaceOrderResult =
  | { ok: true; url: string }
  | { ok: false; message: string; menuItemId?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** create_order raises with detail '{"menu_item_id":"…"}' so the UI can mark the row. */
function offendingItem(details: string | null | undefined): string | undefined {
  if (!details) return undefined;
  try {
    const parsed = JSON.parse(details) as { menu_item_id?: string };
    return parsed.menu_item_id;
  } catch {
    return undefined;
  }
}

export async function placeOrder(input: {
  items: OrderPayloadLine[];
  customerName: string;
  notes: string;
  paymentMethod: "online" | "counter";
}): Promise<PlaceOrderResult> {
  // Trust boundary. create_order validates all of this again in SQL; this pass
  // exists so obvious junk never reaches the database.
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, message: "Nothing on the pass in this order." };
  }
  if (input.items.length > 50) {
    return { ok: false, message: "Too many lines on one order." };
  }
  if (input.paymentMethod !== "online" && input.paymentMethod !== "counter") {
    return { ok: false, message: "Choose how you would like to pay." };
  }
  for (const line of input.items) {
    if (!UUID.test(line.menu_item_id)) {
      return { ok: false, message: "The menu is unavailable right now." };
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) {
      return { ok: false, message: "Quantity out of range." };
    }
  }

  const name = input.customerName.trim().slice(0, 80);
  if (name.length < 2) {
    return { ok: false, message: "A name for the order, so the bar can call it." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_items: input.items,
    p_customer_name: name,
    p_notes: input.notes.trim().slice(0, 280),
    p_payment_method: input.paymentMethod,
  });

  if (error || !data) {
    console.error("create_order failed:", error?.message);
    return {
      ok: false,
      message: error?.message ?? "The order could not be placed.",
      menuItemId: offendingItem(error?.details),
    };
  }

  const token = data.access_token;

  if (input.paymentMethod === "counter") {
    return { ok: true, url: `/order/${token}` };
  }

  // Line items are built from what the DATABASE stored, never from the cart.
  const { data: doc } = await supabase.rpc("order_by_token", { p_token: token });
  const order = doc as unknown as OrderDoc | null;

  if (!order) {
    console.error("order_by_token missed straight after create_order");
    return { ok: false, message: "The order could not be placed." };
  }

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      // The same deadline the stock hold uses. One expiry governs both systems,
      // so nobody can pay for stock that was already handed back.
      expires_at: Math.floor(new Date(data.expires_at!).getTime() / 1000),
      client_reference_id: data.id,
      metadata: { order_id: data.id },
      success_url: `${origin}/order/${token}`,
      cancel_url: `${origin}/order/${token}`,
      line_items: order.items.map((item) => {
        const unit =
          Number(item.base_price) +
          item.selected_modifiers.reduce(
            (sum, modifier) => sum + Number(modifier.priceOffset),
            0,
          );
        return {
          quantity: item.quantity,
          price_data: {
            currency: "eur",
            // Rounded to cents exactly once, here at the Stripe boundary.
            unit_amount: Math.round(unit * 100),
            product_data: {
              name: item.item_name,
              ...(item.selected_modifiers.length > 0 && {
                description: item.selected_modifiers
                  .map((modifier) => modifier.option)
                  .join(" / "),
              }),
            },
          },
        };
      }),
    });

    // Best effort: the customer's session has no update policy on orders, so a
    // failure here must not block the redirect. The webhook is the record of truth.
    await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", data.id);

    return { ok: true, url: session.url! };
  } catch (stripeError) {
    console.error("stripe session failed:", stripeError);
    return { ok: false, message: "Card payment is unavailable. Pay at the bar instead." };
  }
}
