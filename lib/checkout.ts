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

// Stripe metadata: 50 keys, 500 characters per value. The cart is JSON, so it
// is split across numbered keys and glued back together on the way out.
const CHUNK = 500;
const ITEMS_KEY = "items_";

/**
 * Parks the cart on the Stripe session, because until the card clears there is
 * nowhere else to put it — no order row exists yet. The session is the record.
 */
export function packItems(items: OrderPayloadLine[]): Record<string, string> {
  const json = JSON.stringify(items);
  const packed: Record<string, string> = {};
  for (let i = 0; i * CHUNK < json.length; i += 1) {
    packed[`${ITEMS_KEY}${i}`] = json.slice(i * CHUNK, (i + 1) * CHUNK);
  }
  return packed;
}

/** Rebuilds the cart from a paid session. Null means the metadata is unusable. */
export function unpackItems(metadata: Record<string, string> | null): OrderPayloadLine[] | null {
  if (!metadata) return null;
  let json = "";
  // Index order, not key order: Stripe hands metadata back alphabetically, so
  // items_10 would otherwise land between items_1 and items_2.
  for (let i = 0; metadata[`${ITEMS_KEY}${i}`] !== undefined; i += 1) {
    json += metadata[`${ITEMS_KEY}${i}`];
  }
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as OrderPayloadLine[]) : null;
  } catch {
    return null;
  }
}
