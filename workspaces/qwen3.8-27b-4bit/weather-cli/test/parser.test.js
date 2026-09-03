"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseLocation, ParseError } = require("../src/parser");

test("parses valid coordinates in lat lon order", () => {
  const r = parseLocation("59.91 10.75");
  assert.equal(r.kind, "coords");
  assert.equal(r.lat, 59.91);
  assert.equal(r.lon, 10.75);
});

test("parses negative coordinates", () => {
  const r = parseLocation("-33.86 151.2");
  assert.equal(r.kind, "coords");
  assert.equal(r.lat, -33.86);
  assert.equal(r.lon, 151.2);
});

test("treats a place name as a name lookup", () => {
  const r = parseLocation("Oslo");
  assert.equal(r.kind, "name");
  assert.equal(r.name, "Oslo");
});

test("rejects latitude out of range", () => {
  assert.throws(() => parseLocation("91 10"), ParseError);
});

test("rejects longitude out of range", () => {
  assert.throws(() => parseLocation("59 181"), ParseError);
});

test("rejects empty input", () => {
  assert.throws(() => parseLocation(""), ParseError);
  assert.throws(() => parseLocation("   "), ParseError);
  assert.throws(() => parseLocation(undefined), ParseError);
});

test("treats a non-numeric string as a name lookup", () => {
  const r = parseLocation("abc def");
  assert.equal(r.kind, "name");
  assert.equal(r.name, "abc def");
});

test("does not treat a single number as coordinates", () => {
  const r = parseLocation("59.91");
  assert.equal(r.kind, "name");
});
