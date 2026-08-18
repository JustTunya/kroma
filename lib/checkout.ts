import type { CartLine } from "@/lib/cart";

export type OrderPayloadLine = {
  menu_item_id: string;
  quantity: number;
  modifiers: { group: string; option: string }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Strips every price before the cart leaves the browser.
 *
 * create_order() recomputes base_price and priceOffset from menu_items, so
 * anything the client says about money is ignored — which means it must not be
 * sent at all. A payload carrying prices invites someone to try.
 */
export function toOrderPayload(lines: CartLine[]): OrderPayloadLine[] {
  return lines.map((line) => ({
    menu_item_id: line.menuItemId,
    quantity: line.quantity,
    modifiers: line.selectedModifiers.map((modifier) => ({
      group: modifier.group,
      option: modifier.option,
    })),
  }));
}

/**
 * app/page.tsx falls back to menu.json when Supabase returns nothing, minting
 * `seed-N` ids. Those are not uuids and can never be ordered.
 */
export function isOrderable(lines: CartLine[]): boolean {
  return lines.length > 0 && lines.every((line) => UUID.test(line.menuItemId));
}
