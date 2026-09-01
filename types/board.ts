import type { OrderStatus } from "@/lib/order-status";

/**
 * Exactly what staff_order() returns. Keep the two in step — the RPC is the
 * authority on which fields the shop may see, and access_token, user_id and
 * the stripe_* columns are deliberately absent from both.
 */
export type BoardOrder = {
  id: string;
  order_number: number;
  day_number: number | null;
  status: OrderStatus;
  customer_name: string | null;
  /** The name called over the pass, not the name on the account. */
  bar_name: string | null;
  avoid_allergens: string[];
  /** Orders this person has collected before. Their standing, in one number. */
  is_regular: number;
  notes: string | null;
  subtotal: number;
  total: number;
  payment_method: "online" | "counter";
  placed_at: string;
  pickup_at: string | null;
  started_at: string | null;
  ready_at: string | null;
  collected_at: string | null;
  /** Display name of whoever claimed it, resolved by the RPC. */
  claimed_by: string | null;
  items: BoardOrderItem[];
};

export type BoardOrderItem = {
  item_name: string;
  menu_item_id: string | null;
  quantity: number;
  selected_modifiers: { group: string; option: string; priceOffset: number }[];
  line_total: number;
  /** The item ran out after this order was paid for. */
  gone: boolean;
};
