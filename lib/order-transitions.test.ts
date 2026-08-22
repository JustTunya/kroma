// node --test lib/order-transitions.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  UNDO_WINDOW_MS,
  canUndoFreely,
  transitionAction,
} from "./order-transitions.ts";

test("forward moves along the pass need only order.advance", () => {
  assert.equal(transitionAction("pending", "paid"), "order.advance");
  assert.equal(transitionAction("paid", "preparing"), "order.advance");
  assert.equal(transitionAction("preparing", "ready"), "order.advance");
  assert.equal(transitionAction("ready", "collected"), "order.advance");
});

test("voiding and refunding are separate permissions", () => {
  assert.equal(transitionAction("pending", "cancelled"), "order.void");
  assert.equal(transitionAction("paid", "cancelled"), "order.void");
  assert.equal(transitionAction("ready", "cancelled"), "order.void");
  assert.equal(transitionAction("collected", "refunded"), "order.refund");
});

test("a refund is only reachable from collected", () => {
  assert.equal(transitionAction("ready", "refunded"), null);
  assert.equal(transitionAction("paid", "refunded"), null);
});

test("a collected order can no longer be voided — the stock is gone", () => {
  assert.equal(transitionAction("collected", "cancelled"), null);
});

test("skipping a lane is not a transition", () => {
  assert.equal(transitionAction("paid", "collected"), null);
  assert.equal(transitionAction("pending", "ready"), null);
  assert.equal(transitionAction("ready", "pending"), null);
});

test("one lane back is an undo", () => {
  assert.equal(transitionAction("ready", "preparing"), "order.undo");
  assert.equal(transitionAction("collected", "ready"), "order.undo");
  assert.equal(transitionAction("preparing", "paid"), "order.undo");
});

test("a settled order goes nowhere", () => {
  assert.equal(transitionAction("cancelled", "paid"), null);
  assert.equal(transitionAction("refunded", "collected"), null);
});

test("the undo window is 90 seconds, inclusive at the boundary", () => {
  const now = new Date("2026-08-22T10:00:00Z");
  const justInside = new Date(now.getTime() - UNDO_WINDOW_MS);
  const justOutside = new Date(now.getTime() - UNDO_WINDOW_MS - 1);

  assert.equal(canUndoFreely(justInside, now), true);
  assert.equal(canUndoFreely(justOutside, now), false);
  assert.equal(canUndoFreely(null, now), false);
});
