
import assert from "node:assert/strict";
import { test } from "node:test";

import { ageFraction, ageTier, elapsedLabel, isStale } from "./order-age.ts";

const NOW = new Date("2026-08-22T10:00:00Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);

test("under five minutes is fresh", () => {
  assert.equal(ageTier(minutesAgo(0), NOW), "fresh");
  assert.equal(ageTier(minutesAgo(4.9), NOW), "fresh");
});

test("five to ten minutes is warm", () => {
  assert.equal(ageTier(minutesAgo(5), NOW), "warm");
  assert.equal(ageTier(minutesAgo(9.9), NOW), "warm");
});

test("past ten minutes is late", () => {
  assert.equal(ageTier(minutesAgo(10), NOW), "late");
  assert.equal(ageTier(minutesAgo(45), NOW), "late");
});

test("a clock skewed into the future reads as fresh, never negative", () => {
  assert.equal(ageTier(new Date(NOW.getTime() + 60_000), NOW), "fresh");
  assert.equal(ageFraction(new Date(NOW.getTime() + 60_000), NOW), 0);
});

test("the spine fills over ten minutes and then stops", () => {
  assert.equal(ageFraction(minutesAgo(0), NOW), 0);
  assert.equal(ageFraction(minutesAgo(5), NOW), 0.5);
  assert.equal(ageFraction(minutesAgo(10), NOW), 1);
  assert.equal(ageFraction(minutesAgo(90), NOW), 1, "a forgotten order stays full");
});

test("half an hour means nobody is coming for it", () => {
  assert.equal(isStale(minutesAgo(29), NOW), false);
  assert.equal(isStale(minutesAgo(30), NOW), true);
  assert.equal(isStale(minutesAgo(120), NOW), true);
});

test("the label counts m:ss — a bar reads numbers, not 'about 3 minutes'", () => {
  assert.equal(elapsedLabel(minutesAgo(0), NOW), "0:00");
  assert.equal(elapsedLabel(minutesAgo(1.5), NOW), "1:30");
  assert.equal(elapsedLabel(minutesAgo(12), NOW), "12:00");
  assert.equal(elapsedLabel(minutesAgo(59.9), NOW), "59:54");
  assert.equal(elapsedLabel(new Date(NOW.getTime() + 5_000), NOW), "0:00");
});

test("past an hour it switches to h:mm, so a stale order is legible", () => {
  assert.equal(elapsedLabel(minutesAgo(60), NOW), "1h00");
  assert.equal(elapsedLabel(minutesAgo(95), NOW), "1h35");

  assert.equal(elapsedLabel(minutesAgo(4697), NOW), "78h17");
});
