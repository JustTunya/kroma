import assert from "node:assert/strict";
import { test } from "node:test";

import { rhythm, tally } from "./account-stats.ts";

test("rhythm buckets by Bucharest weekday and hour, ties go to the earliest", () => {
  // Mon 2026-09-21 05:10Z = 08:10 local (EEST), Tue 09-22 05:40Z = 08:40, Tue 09-22 10:00Z = 13:00
  const r = rhythm(["2026-09-21T05:10:00Z", "2026-09-22T05:40:00Z", "2026-09-22T10:00:00Z"]);

  assert.deepEqual(r.byDay, [1, 2, 0, 0, 0, 0, 0]);
  assert.equal(r.peakDay, 1);
  assert.equal(r.peakHour, 8);
  assert.equal(r.total, 3);
});

test("rhythm on no orders has no peak", () => {
  const r = rhythm([]);
  assert.equal(r.peakDay, null);
  assert.equal(r.peakHour, null);
});

test("tally sums quantity, keeps the newest modifier set, skips deleted items", () => {
  const mod = (option: string) => [{ group: "Milk", option, priceOffset: 0 }];
  const line = (id: string | null, quantity: number, option: string) => ({
    menu_item_id: id,
    item_name: id ?? "gone",
    quantity,
    selected_modifiers: mod(option),
  });

  const out = tally([
    { order_items: [line("a", 1, "Oat"), line(null, 5, "x")] },
    { order_items: [line("a", 2, "Whole"), line("b", 1, "Whole")] },
  ]);

  assert.deepEqual(
    out.map((i) => [i.id, i.quantity, i.modifiers[0].option]),
    [
      ["a", 3, "Oat"],
      ["b", 1, "Whole"],
    ],
  );
});
