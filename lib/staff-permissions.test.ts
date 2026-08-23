// node --test lib/staff-permissions.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { STAFF_ACTIONS, staffCan } from "./staff-permissions.ts";

test("staff may run the pass but not settle money", () => {
  assert.equal(staffCan("staff", "order.advance"), true);
  assert.equal(staffCan("staff", "order.note"), true);
  assert.equal(staffCan("staff", "item.86"), true);
  // Writing off a drink nobody came for moves neither stock nor money, so it
  // is the closing barista's call. Doing it EARLY is not: advance_order()
  // charges an abandon inside the half hour to order.void.
  assert.equal(staffCan("staff", "order.abandon"), true);
  assert.equal(staffCan("staff", "order.void"), false);
  assert.equal(staffCan("staff", "order.refund"), false);
  assert.equal(staffCan("staff", "customer.contact"), false);
  assert.equal(staffCan("staff", "analytics.view"), false);
});

test("manager settles money but does not manage the roster", () => {
  assert.equal(staffCan("manager", "order.void"), true);
  assert.equal(staffCan("manager", "order.refund"), true);
  assert.equal(staffCan("manager", "customer.contact"), true);
  assert.equal(staffCan("manager", "analytics.view"), true);
  assert.equal(staffCan("manager", "staff.manage"), false);
  assert.equal(staffCan("manager", "shop.settings"), false);
});

test("owner can do everything on the list", () => {
  for (const action of STAFF_ACTIONS) {
    assert.equal(staffCan("owner", action), true, `owner denied ${action}`);
  }
});

test("an unknown action denies rather than grants", () => {
  // @ts-expect-error deliberately outside the union — a typo must not grant.
  assert.equal(staffCan("owner", "nonsense.action"), false);
});
