
import assert from "node:assert/strict";
import { test } from "node:test";

import { dayLabel, parOverrides } from "./service-day.ts";
import type { ParItem } from "./service-day.ts";

const items: ParItem[] = [
  { id: "a", name: "Croissant", par_stock: 18 },
  { id: "b", name: "Cinnamon Bun", par_stock: 12 },
];

test("only counts that differ from par are sent", () => {
  assert.deepEqual(parOverrides(items, { a: 18, b: 9 }), { b: 9 });
});

test("an untouched form sends nothing", () => {
  assert.deepEqual(parOverrides(items, { a: 18, b: 12 }), {});
});

test("a missing or junk count falls back to par rather than to zero", () => {
  assert.deepEqual(parOverrides(items, { a: Number.NaN }), {});
});

test("zero is a real count, not a missing one", () => {
  assert.deepEqual(parOverrides(items, { a: 0 }), { a: 0 });
});

test("the day reads as the shop reads it", () => {
  assert.equal(dayLabel("2026-09-02"), "Wednesday 2 September");
});
