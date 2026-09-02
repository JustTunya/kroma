// node --test lib/discount.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { previewDiscount } from "./discount.ts";

test("a percentage comes off the subtotal, rounded to the cent", () => {
  assert.deepEqual(previewDiscount(14.6, "percent", 10), { off: 1.46, total: 13.14 });
});

test("an amount never takes the total below zero", () => {
  assert.deepEqual(previewDiscount(4.2, "amount", 10), { off: 4.2, total: 0 });
});

test("a comp is the lot", () => {
  assert.deepEqual(previewDiscount(14.6, "comp", 0), { off: 14.6, total: 0 });
});

test("a negative value is not a discount", () => {
  assert.deepEqual(previewDiscount(14.6, "amount", -5), { off: 0, total: 14.6 });
});
