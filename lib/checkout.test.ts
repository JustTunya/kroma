
import assert from "node:assert/strict";
import { test } from "node:test";

import { isOrderable, packItems, toOrderPayload, unpackItems } from "./checkout.ts";
import type { CartLine } from "./cart.ts";

const latte: CartLine = {
  id: "line-1",
  menuItemId: "22222222-2222-2222-2222-222222222222",
  name: "Latte",
  basePrice: 4.0,
  quantity: 2,
  selectedModifiers: [{ group: "Milk Choice", option: "Oat Milk", priceOffset: 0.6 }],
  imageUrl: "/latte.webp",
};

test("toOrderPayload keeps ids, quantities and modifier names", () => {
  assert.deepEqual(toOrderPayload([latte]), [
    {
      menu_item_id: "22222222-2222-2222-2222-222222222222",
      quantity: 2,
      modifiers: [{ group: "Milk Choice", option: "Oat Milk" }],
    },
  ]);
});

test("toOrderPayload leaks no price field — the tamper boundary", () => {
  const serialized = JSON.stringify(toOrderPayload([latte]));
  for (const banned of ["basePrice", "base_price", "priceOffset", "price_offset", "total"]) {
    assert.equal(
      serialized.includes(banned),
      false,
      `payload must not carry ${banned}; the database recomputes it`,
    );
  }
});

test("toOrderPayload does not mutate its input", () => {
  const before = JSON.stringify(latte);
  toOrderPayload([latte]);
  assert.equal(JSON.stringify(latte), before);
});

test("isOrderable rejects the seed fallback ids from app/page.tsx", () => {
  assert.equal(isOrderable([latte]), true);
  assert.equal(isOrderable([{ ...latte, menuItemId: "seed-3" }]), false);
});

test("isOrderable rejects an empty cart", () => {
  assert.equal(isOrderable([]), false);
});

test("packItems/unpackItems survive a cart bigger than one metadata value", () => {

  const items = Array.from({ length: 50 }, (_, index) => ({
    menu_item_id: `2222222${index % 10}-2222-2222-2222-222222222222`,
    quantity: (index % 9) + 1,
    modifiers: [{ group: "Milk Choice", option: "Oat Milk" }],
  }));

  const packed = packItems(items);

  assert.ok(Object.keys(packed).length > 11);
  for (const value of Object.values(packed)) assert.ok(value.length <= 500);
  assert.ok(Object.keys(packed).length <= 50, "would not fit in Stripe metadata");

  assert.deepEqual(unpackItems(packed), items);
});

test("unpackItems refuses anything it cannot trust", () => {
  assert.equal(unpackItems(null), null);
  assert.equal(unpackItems({}), null);
  assert.equal(unpackItems({ items_0: "{not json" }), null);
  assert.equal(unpackItems({ items_0: "[]" }), null);

  assert.equal(unpackItems({ items_1: '[{"menu_item_id":"x"}]' }), null);
});
