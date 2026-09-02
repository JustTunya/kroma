
import assert from "node:assert/strict";
import { test } from "node:test";

import { slugify, validModifiers } from "./menu-admin.ts";

test("the slug survives Romanian diacritics", () => {
  assert.equal(slugify("Cafea cu Lapte"), "cafea-cu-lapte");
  assert.equal(slugify("Șocolată  Caldă"), "socolata-calda");
  assert.equal(slugify("  Flat White  "), "flat-white");
});

test("a group with no options is not a group", () => {
  assert.equal(validModifiers([{ name: "Milk", required: true, options: [] }]), false);
});

test("an option needs a name and a numeric offset", () => {
  assert.equal(
    validModifiers([{ name: "Milk", required: true, options: [{ name: "Oat", priceOffset: 0.6 }] }]),
    true,
  );
  assert.equal(
    validModifiers([
      { name: "Milk", required: true, options: [{ name: "", priceOffset: 0 }] },
    ]),
    false,
  );
});

test("duplicate option names inside one group are refused", () => {
  assert.equal(
    validModifiers([
      {
        name: "Milk",
        required: true,
        options: [
          { name: "Oat", priceOffset: 0.6 },
          { name: "Oat", priceOffset: 0.8 },
        ],
      },
    ]),
    false,
  );
});
