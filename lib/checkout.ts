import type { CartLine } from "@/lib/cart";

export type OrderPayloadLine = {
  menu_item_id: string;
  quantity: number;
  modifiers: { group: string; option: string }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export function isOrderable(lines: CartLine[]): boolean {
  return lines.length > 0 && lines.every((line) => UUID.test(line.menuItemId));
}

// One unit's price on the redeemed line, or 0 — mirrors order_lines()'s "one
// unit free, never the whole line" rule so the checkout preview matches what
// the DB actually charges.
export function rewardAmount(lines: CartLine[], redeemItemId: string | undefined): number {
  const line = lines.find((l) => l.menuItemId === redeemItemId);
  if (!line) return 0;
  return (
    line.basePrice + line.selectedModifiers.reduce((sum, modifier) => sum + modifier.priceOffset, 0)
  );
}

const CHUNK = 500;
const ITEMS_KEY = "items_";

export function packItems(items: OrderPayloadLine[]): Record<string, string> {
  const json = JSON.stringify(items);
  const packed: Record<string, string> = {};
  for (let i = 0; i * CHUNK < json.length; i += 1) {
    packed[`${ITEMS_KEY}${i}`] = json.slice(i * CHUNK, (i + 1) * CHUNK);
  }
  return packed;
}

export function unpackItems(metadata: Record<string, string> | null): OrderPayloadLine[] | null {
  if (!metadata) return null;
  let json = "";

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
