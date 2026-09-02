
import assert from "node:assert/strict";
import { test } from "node:test";

import { receiptText } from "./receipt.ts";
import type { Receipt } from "./receipt.ts";

const receipt: Receipt = {
  day_number: 42,
  placed_at: "2026-09-02T05:14:00.000Z",
  settled_as: "cash",
  payment_method: "counter",
  subtotal: 13.2,
  discount_total: 1,
  discount_reason: "Spilled it",
  total: 12.2,
  tax_total: 1.21,
  items: [
    {
      item_name: "Cortado",
      quantity: 2,
      line_total: 8.4,
      vat_rate: 0.11,
      selected_modifiers: [{ group: "Milk", option: "Oat Milk", priceOffset: 0.6 }],
    },
  ],
};

test("the receipt names the shop and the ticket", () => {
  const text = receiptText(receipt);
  assert.match(text, /KROMA COFFEE & BAKEHOUSE/);
  assert.match(text, /#042/);
});

test("every line, its modifiers and its money are present", () => {
  const text = receiptText(receipt);
  assert.match(text, /2 × CORTADO\s+€8\.40/);
  assert.match(text, /OAT MILK/);
});

test("the discount is shown as a subtraction with its reason", () => {
  const text = receiptText(receipt);
  assert.match(text, /DISCOUNT\s+−€1\.00/);
  assert.match(text, /SPILLED IT/);
});

test("VAT is stated as included, never added", () => {
  const text = receiptText(receipt);
  assert.match(text, /TOTAL\s+€12\.20/);
  assert.match(text, /INCL\. VAT 11%\s+€1\.21/);
});

test("it says plainly that it is not a fiscal receipt", () => {
  assert.match(receiptText(receipt), /NOT A FISCAL RECEIPT/);
});
