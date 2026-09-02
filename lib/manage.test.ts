
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  actionsFor,
  duration,
  readRange,
  shiftDayKey,
  shopDayKey,
  shopDayStart,
  tapeScale,
  TAPE_STACK,
} from "./manage.ts";

test("a shop day starts at local midnight, not UTC midnight", () => {
  assert.equal(shopDayStart("2026-08-23").toISOString(), "2026-08-22T21:00:00.000Z");
  assert.equal(shopDayStart("2026-01-15").toISOString(), "2026-01-14T22:00:00.000Z");
});

test("late evening UTC is already tomorrow in the shop", () => {

  assert.equal(shopDayKey(new Date("2026-08-22T22:30:00Z")), "2026-08-23");
  assert.equal(shopDayKey(new Date("2026-08-22T20:30:00Z")), "2026-08-22");
});

test("the clocks going forward does not lose or duplicate a day", () => {

  assert.equal(shiftDayKey("2026-03-28", 1), "2026-03-29");
  assert.equal(shiftDayKey("2026-03-29", 1), "2026-03-30");
  assert.equal(shiftDayKey("2026-10-25", 1), "2026-10-26");
  assert.equal(shiftDayKey("2026-08-23", -1), "2026-08-22");
});

test("no params means today, one day wide, half-open", () => {
  const range = readRange({}, "2026-08-23");
  assert.equal(range.fromKey, "2026-08-23");
  assert.equal(range.toKey, "2026-08-23");
  assert.equal(range.days, 1);
  assert.equal(range.preset, "today");
  assert.equal(range.from.toISOString(), "2026-08-22T21:00:00.000Z");

  assert.equal(range.to.toISOString(), "2026-08-23T21:00:00.000Z");
});

test("a seven-day window lights the seven-day preset", () => {
  const range = readRange({ from: "2026-08-17", to: "2026-08-23" }, "2026-08-23");
  assert.equal(range.days, 7);
  assert.equal(range.preset, "7");
});

test("a window that does not end today lights no preset", () => {
  assert.equal(readRange({ from: "2026-08-10", to: "2026-08-16" }, "2026-08-23").preset, null);
});

test("garbage in the query string falls back to today rather than blanking", () => {
  const bad = readRange({ from: "yesterday", to: "23/08/2026" }, "2026-08-23");
  assert.equal(bad.fromKey, "2026-08-23");
  assert.equal(bad.toKey, "2026-08-23");
});

test("the future is clamped to today and a backwards range collapses", () => {
  assert.equal(readRange({ to: "2027-01-01" }, "2026-08-23").toKey, "2026-08-23");

  const flipped = readRange({ from: "2026-08-23", to: "2026-08-10" }, "2026-08-23");
  assert.equal(flipped.fromKey, flipped.toKey);
});

test("an absurd range is capped rather than scanning the whole table", () => {
  const huge = readRange({ from: "2020-01-01", to: "2026-08-23" }, "2026-08-23");
  assert.equal(huge.days, 367);
});

test("no category selected means no filter, not an empty filter", () => {
  assert.equal(actionsFor([]), null);
  assert.equal(actionsFor(["Nonsense"]), null);
  assert.deepEqual(actionsFor(["Stock"]), ["item.86"]);
  assert.ok(actionsFor(["Shifts", "Stock"])!.includes("shift.start"));
});

test("durations round to one unit and never read 0h 0m", () => {
  assert.equal(duration(48), "48s");
  assert.equal(duration(59), "59s");
  assert.equal(duration(190), "3m");
  assert.equal(duration(3600), "1h");
  assert.equal(duration(15_600), "4h 20m");
  assert.equal(duration(null), "—");
  assert.equal(duration(-5), "—");
});

test("a tick is one order until the stack would overflow", () => {
  for (const busiest of [1, 7, 40, 60]) {
    const { perTick, pitch } = tapeScale(busiest);
    assert.equal(perTick, 1, `${busiest} orders should still be one tick each`);
    assert.ok(busiest * pitch <= TAPE_STACK, `${busiest} × ${pitch} overflows`);
  }
});

test("past capacity a tick counts several, and nothing ever overflows", () => {

  for (const busiest of [61, 120, 400, 1200, 9999]) {
    const { perTick, pitch } = tapeScale(busiest);
    assert.ok(perTick > 1);
    assert.ok(
      Math.round(busiest / perTick) * pitch <= TAPE_STACK,
      `${busiest} orders overflow at ${perTick}/tick × ${pitch}px`,
    );
  }
});
