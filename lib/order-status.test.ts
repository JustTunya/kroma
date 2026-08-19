import assert from "node:assert/strict";
import { test } from "node:test";

import { ORDER_STATUSES, ORDER_STATUS_LABELS, isSettled } from "./order-status.ts";

test("every status has a label and a tone class", () => {
  for (const status of ORDER_STATUSES) {
    const label = ORDER_STATUS_LABELS[status];
    assert.ok(label, `no label for ${status}`);
    assert.ok(label.text.length > 0, `empty text for ${status}`);
    assert.match(label.tone, /^text-/, `tone for ${status} is not a text- class`);
  }
});

test("the label map has no entries beyond the enum", () => {
  assert.deepEqual(
    Object.keys(ORDER_STATUS_LABELS).sort(),
    [...ORDER_STATUSES].sort(),
  );
});

test("only collected and cancelled are settled", () => {
  assert.equal(isSettled("collected"), true);
  assert.equal(isSettled("cancelled"), true);
  assert.equal(isSettled("paid"), false);
  assert.equal(isSettled("preparing"), false);
});
