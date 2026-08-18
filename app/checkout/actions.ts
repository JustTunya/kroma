"use server";

import { createClient } from "@/lib/server";
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

  return { ok: true, url: `/order/${data.access_token}` };
}
