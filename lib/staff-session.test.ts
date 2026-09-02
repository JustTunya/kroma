
import assert from "node:assert/strict";
import { test } from "node:test";

import { ACTOR_TTL_MS, readActor, signActor } from "./staff-session.ts";

const SECRET = "test-secret-not-a-real-one";
const NOW = new Date("2026-08-22T10:00:00Z");

const payload = {
  staffId: "11111111-1111-1111-1111-111111111111",
  role: "manager" as const,
  name: "Ana",
  exp: NOW.getTime() + ACTOR_TTL_MS,
};

test("a token round-trips", () => {
  assert.deepEqual(readActor(signActor(payload, SECRET), SECRET, NOW), payload);
});

test("a tampered payload is rejected", () => {
  const token = signActor(payload, SECRET);
  const [body, signature] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ ...payload, role: "owner" }),
  ).toString("base64url");

  assert.notEqual(body, forged, "the forged body must actually differ");
  assert.equal(readActor(`${forged}.${signature}`, SECRET, NOW), null);
});

test("a token signed with another secret is rejected", () => {
  assert.equal(readActor(signActor(payload, "other"), SECRET, NOW), null);
});

test("an expired token is rejected", () => {
  const token = signActor(payload, SECRET);
  assert.equal(
    readActor(token, SECRET, new Date(NOW.getTime() + ACTOR_TTL_MS + 1)),
    null,
  );
});

test("garbage is rejected without throwing", () => {
  assert.equal(readActor(undefined, SECRET, NOW), null);
  assert.equal(readActor("", SECRET, NOW), null);
  assert.equal(readActor("not-a-token", SECRET, NOW), null);
  assert.equal(readActor("a.b.c", SECRET, NOW), null);

  assert.equal(readActor("abc.short", SECRET, NOW), null);
});

test("a payload with no expiry is rejected", () => {
  const body = Buffer.from(JSON.stringify({ staffId: "x" })).toString(
    "base64url",
  );

  const token = signActor(
    { ...payload, exp: NOW.getTime() + ACTOR_TTL_MS },
    SECRET,
  );
  assert.notEqual(token.split(".")[0], body);
  assert.equal(readActor(`${body}.${token.split(".")[1]}`, SECRET, NOW), null);
});
