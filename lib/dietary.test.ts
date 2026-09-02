
import assert from "node:assert/strict";
import { test } from "node:test";

import { asOrdered, conflicts, passLine, type ItemDietary } from "./dietary.ts";

const flatWhite: ItemDietary = { dietary_tags: ["Vegetarian"], allergens: ["Dairy"] };
const croissant: ItemDietary = {
  dietary_tags: ["Vegetarian"],
  allergens: ["Gluten", "Dairy", "Eggs"],
};
const saladBowl: ItemDietary = { dietary_tags: ["Vegan", "Gluten-Free"], allergens: [] };

test("an item with nothing the customer avoids raises nothing", () => {
  assert.deepEqual(conflicts(saladBowl, { diets: ["Vegan"], avoid: ["Dairy"] }), []);
});

test("empty preferences never conflict", () => {
  assert.deepEqual(conflicts(croissant, { diets: [], avoid: [] }), []);
});

test("an avoided allergen is named", () => {
  assert.deepEqual(conflicts(flatWhite, { diets: [], avoid: ["Dairy"] }), ["Contains dairy"]);
});

test("a missing diet tag is named", () => {
  assert.deepEqual(conflicts(flatWhite, { diets: ["Vegan"], avoid: [] }), ["Not vegan"]);
});

test("allergens are listed before diets", () => {
  assert.deepEqual(conflicts(croissant, { diets: ["Vegan"], avoid: ["Eggs", "Gluten"] }), [
    "Contains gluten",
    "Contains eggs",
    "Not vegan",
  ]);
});

test("a stricter tag satisfies a looser diet", () => {
  assert.deepEqual(conflicts(saladBowl, { diets: ["Vegetarian", "Pescatarian"], avoid: [] }), []);
});

test("gluten-free is not implied by vegan", () => {
  const veganBun: ItemDietary = { dietary_tags: ["Vegan"], allergens: ["Gluten"] };
  assert.deepEqual(conflicts(veganBun, { diets: ["Gluten-Free"], avoid: [] }), ["Not gluten-free"]);
});

test("swapping the milk clears the dairy and earns the vegan claim", () => {
  const oat = [{ group: "Milk Choice", option: "Oat Milk (Vegan)" }];
  assert.deepEqual(asOrdered(flatWhite, oat), {
    dietary_tags: ["Vegetarian", "Vegan"],
    allergens: [],
  });
  assert.deepEqual(conflicts(flatWhite, { diets: ["Vegan"], avoid: ["Dairy"] }, oat), []);
});

test("almond milk clears the dairy but brings nuts", () => {
  const almond = [{ group: "Milk Choice", option: "Almond Milk (Contains Nuts)" }];
  assert.deepEqual(conflicts(flatWhite, { diets: [], avoid: ["Dairy", "Tree Nuts"] }, almond), [
    "Contains tree nuts",
  ]);
});

test("a modifier cannot make a non-vegetarian item vegan", () => {
  const baconRoll: ItemDietary = { dietary_tags: [], allergens: ["Gluten"] };
  const oat = [{ group: "Milk Choice", option: "Oat Milk (Vegan)" }];
  assert.deepEqual(conflicts(baconRoll, { diets: ["Vegan"], avoid: [] }, oat), ["Not vegan"]);
});

test("an unknown modifier changes nothing", () => {
  const syrup = [{ group: "Syrup", option: "Cardamom Vanilla" }];
  assert.deepEqual(conflicts(flatWhite, { diets: [], avoid: ["Dairy"] }, syrup), [
    "Contains dairy",
  ]);
});

test("the pass line reads diets first, then what to leave out", () => {
  assert.deepEqual(passLine({ diets: ["Vegan"], avoid: ["Gluten", "Dairy"] }), [
    "Vegan",
    "No dairy",
    "No gluten",
  ]);
});
