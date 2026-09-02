import type { OrderStatus } from "@/lib/order-status";

export type BoardOrder = {
  id: string;
  order_number: number;
  day_number: number | null;
  status: OrderStatus;
  customer_name: string | null;

  bar_name: string | null;
  avoid_allergens: string[];

  is_regular: number;
  notes: string | null;
  subtotal: number;
  total: number;
  settled_as: "cash" | "card" | "online" | null;
  discount_total: number;
  discount_reason: string | null;
  payment_method: "online" | "counter";
  placed_at: string;
  pickup_at: string | null;
  started_at: string | null;
  ready_at: string | null;
  collected_at: string | null;

  claimed_by: string | null;
  items: BoardOrderItem[];
};

export type BoardOrderItem = {
  item_name: string;
  menu_item_id: string | null;
  quantity: number;
  selected_modifiers: { group: string; option: string; priceOffset: number }[];
  line_total: number;

  gone: boolean;
};
