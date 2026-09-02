/**
 * The document body, shared by the receipt page and the receipt email — one
 * builder for both, so a `<pre>` and a plain-text send can never drift.
 * Mirrors order_receipt() in 20260901094000_receipts.sql.
 *
 * No import of lib/shop.ts or lib/vat.ts: every lib/*.ts pure module here runs
 * standalone under `node --test`, which has no path-alias resolver, so the
 * handful of lines each would contribute are inlined instead.
 */

const SHOP_NAME = "KROMA Coffee & Bakehouse";
const SHOP_ADDRESS = "Str. Universității 12, Cluj-Napoca, Romania";
const SHOP_VAT_ID = process.env.NEXT_PUBLIC_SHOP_VAT_ID ?? "RO00000000";

/** `Incl. VAT 11%`. Mirrors lib/vat.ts's vatLabel — kept in step by hand. */
function vatLabel(rate: number): string {
  return `Incl. VAT ${Math.round(rate * 100)}%`;
}

export type ReceiptItem = {
  item_name: string;
  quantity: number;
  line_total: number;
  vat_rate: number;
  selected_modifiers: { group: string; option: string; priceOffset: number }[];
};

export type Receipt = {
  day_number: number | null;
  order_number?: number;
  placed_at: string;
  settled_as: "cash" | "card" | "online" | null;
  payment_method: "online" | "counter";
  subtotal: number;
  discount_total: number;
  discount_reason: string | null;
  total: number;
  tax_total: number;
  items: ReceiptItem[];
};

const WIDTH = 32;
const RULE = "-".repeat(WIDTH);
const money = (n: number) => `€${n.toFixed(2)}`;

/** Left text, right amount, padded to the receipt's column width. */
function row(left: string, right: string): string {
  const gap = Math.max(1, WIDTH - left.length - right.length);
  return left + " ".repeat(gap) + right;
}

const TENDER_WORD: Record<string, string> = {
  cash: "Cash",
  card: "Card at the bar",
  online: "Paid online",
};

export function receiptText(receipt: Receipt): string {
  const lines: string[] = [];

  lines.push(SHOP_NAME.toUpperCase());
  lines.push(SHOP_ADDRESS);
  lines.push(`VAT ${SHOP_VAT_ID}`);
  lines.push(RULE);
  lines.push(`#${String(receipt.day_number ?? "").padStart(3, "0")}`);
  lines.push(new Date(receipt.placed_at).toLocaleString("en-GB"));
  lines.push(
    receipt.settled_as ? TENDER_WORD[receipt.settled_as].toUpperCase() : "NOT PAID YET",
  );
  lines.push(RULE);

  for (const item of receipt.items) {
    lines.push(row(`${item.quantity} × ${item.item_name.toUpperCase()}`, money(item.line_total)));
    for (const modifier of item.selected_modifiers) {
      lines.push(`  ${modifier.option.toUpperCase()}`);
    }
  }

  lines.push(RULE);
  lines.push(row("SUBTOTAL", money(receipt.subtotal)));

  if (receipt.discount_total > 0) {
    lines.push(row("DISCOUNT", `−${money(receipt.discount_total)}`));
    if (receipt.discount_reason) lines.push(`  ${receipt.discount_reason.toUpperCase()}`);
  }

  lines.push(row("TOTAL", money(receipt.total)));

  const rate = receipt.items[0]?.vat_rate ?? 0.11;
  lines.push(row(vatLabel(rate).toUpperCase(), money(receipt.tax_total)));

  lines.push(RULE);
  lines.push("THANK YOU");
  lines.push("");
  lines.push("This is a commercial receipt, not a fiscal one.");
  lines.push("NOT A FISCAL RECEIPT.");

  return lines.join("\n");
}
