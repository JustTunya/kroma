// node --test lib/active-order.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { isRecent, pickupCountdown } from "./active-order.ts";

const NOW = new Date("2026-08-22T10:00:00Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

test("counts the minutes left, rounded up", () => {
  assert.equal(pickupCountdown("preparing", at(9.2), NOW), "10 min");
  assert.equal(pickupCountdown("paid", at(0.1), NOW), "1 min");
});

test("a pickup time gone by reads as any minute, never zero or negative", () => {
  assert.equal(pickupCountdown("preparing", at(0), NOW), "Any minute");
  assert.equal(pickupCountdown("pending", at(-40), NOW), "Any minute");
});

test("a ready order counts down to nothing — it is already waiting", () => {
  assert.equal(pickupCountdown("ready", at(5), NOW), null);
});

test("no pickup time, no countdown", () => {
  assert.equal(pickupCountdown("preparing", null, NOW), null);
});

test("this morning is live, yesterday is forgotten", () => {
  assert.equal(isRecent(at(-20), NOW), true);
  assert.equal(isRecent(at(-60 * 5), NOW), true);
  assert.equal(isRecent(at(-60 * 7), NOW), false);
});
