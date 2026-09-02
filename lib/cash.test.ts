// node --test lib/cash.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { countTotal, DENOMINATIONS, varianceWord } from "./cash.ts";

test("the ladder runs largest first and reaches ten cents", () => {
  assert.equal(DENOMINATIONS[0], 50);
  assert.equal(DENOMINATIONS.at(-1), 0.1);
});

test("a count totals in cents, so floats never drift", () => {
  assert.equal(countTotal({ "0.1": 3, "0.2": 1 }), 0.5);
  assert.equal(countTotal({ "50": 2, "20": 6, "0.5": 12 }), 226);
});

test("an empty or half-typed drawer totals zero, not NaN", () => {
  assert.equal(countTotal({}), 0);
  assert.equal(countTotal({ "50": Number.NaN }), 0);
});

test("variance is stated as the bar would say it", () => {
  assert.deepEqual(varianceWord(0), { word: "Square", tone: "live" });
  assert.deepEqual(varianceWord(3.7), { word: "Over by", tone: "alert" });
  assert.deepEqual(varianceWord(-1.2), { word: "Short by", tone: "alert" });
});
