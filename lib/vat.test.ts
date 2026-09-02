// node --test lib/vat.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { groupByRate, vatLabel, vatOf } from "./vat.ts";

test("VAT is extracted from a gross price, never added to it", () => {
  assert.equal(vatOf(22.2, 0.11), 2.2);
  assert.equal(vatOf(4.2, 0.11), 0.42);
});

test("rounding lands on the cent, half up", () => {
  assert.equal(vatOf(0.05, 0.11), 0.0);
  assert.equal(vatOf(1.0, 0.21), 0.17);
});

test("the label states the rate as a whole percent", () => {
  assert.equal(vatLabel(0.11), "Incl. VAT 11%");
  assert.equal(vatLabel(0.21), "Incl. VAT 21%");
});

test("mixed rates group and total separately", () => {
  const grouped = groupByRate([
    { line_total: 10, vat_rate: 0.11 },
    { line_total: 5, vat_rate: 0.11 },
    { line_total: 10, vat_rate: 0.21 },
  ]);
  assert.deepEqual(grouped, [
    { rate: 0.11, gross: 15, vat: 1.49 },
    { rate: 0.21, gross: 10, vat: 1.74 },
  ]);
});
