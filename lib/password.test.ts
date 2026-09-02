
import assert from "node:assert/strict";
import { test } from "node:test";

import { isStrongPassword, PASSWORD_RULES, strengthLabel } from "./password.ts";

const score = (value: string) => PASSWORD_RULES.filter((rule) => rule.test(value)).length;

test("every class is required", () => {
  assert.equal(isStrongPassword("Fl4t-white"), true);
  assert.equal(isStrongPassword("flatwhite"), false);
  assert.equal(isStrongPassword("FLATWHITE1!"), false);
  assert.equal(isStrongPassword("Flatwhite!"), false);
  assert.equal(isStrongPassword("Flatwhite1"), false);
  assert.equal(isStrongPassword("Fl4t-w"), false);
});

test("score drives the label", () => {
  assert.equal(strengthLabel(score("")), "Too weak");
  assert.equal(strengthLabel(score("flat")), "Too weak");
  assert.equal(strengthLabel(score("Flatwhite1")), "Getting there");
  assert.equal(strengthLabel(score("Fl4t-white")), "Strong");
});
