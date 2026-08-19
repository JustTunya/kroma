"use server";

import { headers } from "next/headers";

import { createClient } from "@/lib/server";
import { stripe } from "@/lib/stripe";
import { packItems, type OrderPayloadLine } from "@/lib/checkout";

export type PlaceOrderResult =
  | { ok: true; url: string }
  | { ok: false; message: string; menuItemId?: string };

type QuoteLine = {
  item_name: string;
  base_price: number;
  quantity: number;
  selected_modifiers: { group: string; option: string; priceOffset: number }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stripe allows 50 metadata keys; the cart chunks must leave room for the rest. */
const MAX_ITEM_CHUNKS = 45;

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
  // Trust boundary. The SQL validates all of this again; this pass exists so
  // obvious junk never reaches the database.
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

  const notes = input.notes.trim().slice(0, 280);
  const supabase = await createClient();

  if (input.paymentMethod === "counter") {
    // Nothing to settle first — placing it IS the order.
    const { data, error } = await supabase.rpc("create_order", {
      p_items: input.items,
      p_customer_name: name,
      p_notes: notes,
      p_payment_method: "counter",
    });

    if (error || !data) {
      console.error("create_order failed:", error?.message);
      return {
        ok: false,
        message: error?.message ?? "The order could not be placed.",
        menuItemId: offendingItem(error?.details),
      };
    }

    return { ok: true, url: `/order/${data.access_token}` };
  }

  // Card. No order is written here, and no stock is taken: an unpaid card is
  // not an order. The cart is priced, parked on the Stripe session, and only
  // becomes an order once the payment clears (lib/payment.ts).
  const { data: quote, error: quoteError } = await supabase.rpc("quote_order", {
    p_items: input.items,
  });

  if (quoteError || !quote) {
    console.error("quote_order failed:", quoteError?.message);
    return {
      ok: false,
      message: quoteError?.message ?? "The order could not be priced.",
      menuItemId: offendingItem(quoteError?.details),
    };
  }

  const lines = (quote as { lines: QuoteLine[] }).lines;
  const packed = packItems(input.items);
  if (Object.keys(packed).length > MAX_ITEM_CHUNKS) {
    return { ok: false, message: "Too many lines on one order." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      // Stripe's floor is 30 minutes. Nothing is held meanwhile, so this is the
      // life of the quote, not of a reservation.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      metadata: {
        ...packed,
        customer_name: name,
        notes,
        ...(user && { user_id: user.id }),
      },
      // Both ends come back to us: /checkout/confirm writes the order, and a
      // cancelled payment lands on a checkout page whose cart is untouched.
      success_url: `${origin}/checkout/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?payment=unfinished`,
      // Prices come from quote_order, which is the same SQL create_order uses.
      line_items: lines.map((line) => {
        const unit =
          Number(line.base_price) +
          line.selected_modifiers.reduce(
            (sum, modifier) => sum + Number(modifier.priceOffset),
            0,
          );
        return {
          quantity: line.quantity,
          price_data: {
            currency: "eur",
            // Rounded to cents exactly once, here at the Stripe boundary.
            unit_amount: Math.round(unit * 100),
            product_data: {
              name: line.item_name,
              ...(line.selected_modifiers.length > 0 && {
                description: line.selected_modifiers
                  .map((modifier) => modifier.option)
                  .join(" / "),
              }),
            },
          },
        };
      }),
    });

    return { ok: true, url: session.url! };
  } catch (stripeError) {
    console.error("stripe session failed:", stripeError);
    return { ok: false, message: "Card payment is unavailable. Pay at the bar instead." };
  }
}
