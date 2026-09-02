
import assert from "node:assert/strict";
import { test } from "node:test";

import { groupByMonth, summarize } from "./order-history.ts";

test("summarize counts extra units of the first line, not just other lines", () => {
  assert.equal(summarize([{ item_name: "Cortado", quantity: 3 }]), "Cortado + 2 more");
  assert.equal(summarize([{ item_name: "Cortado", quantity: 1 }]), "Cortado");
  assert.equal(
    summarize([
      { item_name: "Cortado", quantity: 1 },
      { item_name: "Croissant", quantity: 2 },
    ]),
    "Cortado + 2 more",
  );
  assert.equal(summarize([]), "No lines");
});

test("groupByMonth keeps order and opens a group per run", () => {
  const rows = [
    { month: "August 2026", id: 1 },
    { month: "August 2026", id: 2 },
    { month: "July 2026", id: 3 },
  ];

  assert.deepEqual(groupByMonth(rows), [
    { month: "August 2026", rows: [rows[0], rows[1]] },
    { month: "July 2026", rows: [rows[2]] },
  ]);
});
