// node --test lib/cart.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { cartTotal, lineTotal, mergeCarts } from "./cart.ts";
import type { CartLine } from "./cart.ts";

const flatWhite: CartLine = {
  id: "1",
  menuItemId: "flat-white",
  name: "Flat White",
  basePrice: 4.2,
  quantity: 2,
  selectedModifiers: [{ group: "Milk Choice", option: "Oat Milk (Vegan)", priceOffset: 0.6 }],
  imageUrl: "",
};

test("lineTotal adds modifier offsets before multiplying by quantity", () => {
  assert.equal(lineTotal(flatWhite), (4.2 + 0.6) * 2);
});

test("cartTotal sums every line", () => {
  const espresso: CartLine = {
    ...flatWhite,
    id: "2",
    menuItemId: "espresso",
    basePrice: 2.5,
    quantity: 1,
    selectedModifiers: [],
  };
  assert.equal(cartTotal([flatWhite, espresso]), (4.2 + 0.6) * 2 + 2.5);
});

test("mergeCarts sums quantities for the same item + modifier selection", () => {
  const guestLine: CartLine = { ...flatWhite, id: "guest-1", quantity: 1 };
  const merged = mergeCarts([flatWhite], [guestLine]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].quantity, 3);
});

test("mergeCarts keeps a different modifier selection as its own line", () => {
  const almondMilk: CartLine = {
    ...flatWhite,
    id: "guest-2",
    quantity: 1,
    selectedModifiers: [{ group: "Milk Choice", option: "Almond Milk (Contains Nuts)", priceOffset: 0.6 }],
  };
  const merged = mergeCarts([flatWhite], [almondMilk]);
  assert.equal(merged.length, 2);
});

test("mergeCarts does not mutate its inputs", () => {
  const before = flatWhite.quantity;
  mergeCarts([flatWhite], [{ ...flatWhite, id: "guest-1", quantity: 5 }]);
  assert.equal(flatWhite.quantity, before);
});

// Regression for lib/use-cart.ts's `add`/`addMany`. ReorderButton (and any future
// caller) does `for (const line of lines) add(line)` — N synchronous calls in the
// same tick, before React re-renders. `useCart` can't be unit-tested directly here
// (it's a hook — calling it outside a component render throws, and this repo has
// no React testing-library installed to fake one), so this reproduces the exact
// merge formula `add` uses against the exact call pattern ReorderButton uses. It
// must accumulate to three lines, not collapse to one.
test("three sequential add() calls accumulate to three lines, not collapse to the last one", () => {
  const espresso: CartLine = {
    ...flatWhite,
    id: "3",
    menuItemId: "espresso",
    basePrice: 2.5,
    quantity: 1,
    selectedModifiers: [],
  };
  const pourOver: CartLine = {
    ...flatWhite,
    id: "4",
    menuItemId: "pour-over",
    basePrice: 3.5,
    quantity: 1,
    selectedModifiers: [],
  };
  const toAdd = [flatWhite, espresso, pourOver];

  // lib/use-cart.ts's fixed `add`/`addMany`: `add` delegates to `addMany([line])`,
  // which merges onto `linesRef.current` and `persist` updates that ref
  // synchronously on every call — so each `add` composes onto the *previous
  // call's result*, not a stale render snapshot. `ref` here stands in for
  // `linesRef.current`.
  let ref: CartLine[] = [];
  const add = (line: CartLine) => {
    ref = mergeCarts(ref, [line]);
  };
  for (const line of toAdd) add(line);

  assert.equal(ref.length, 3);
});
