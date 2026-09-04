'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseLocation, parseCoordinates } = require('../src/parser');

test('parses valid coordinates "lat lon"', () => {
  const result = parseLocation('59.91 10.75');
  assert.strictEqual(result.lat, 59.91);
  assert.strictEqual(result.lon, 10.75);
  assert.ok(result.name);
});

test('parses negative coordinates', () => {
  const result = parseLocation('-33.87 151.21');
  assert.strictEqual(result.lat, -33.87);
  assert.strictEqual(result.lon, 151.21);
});

test('accepts boundary coordinates 90/-180', () => {
  const result = parseLocation('90 -180');
  assert.strictEqual(result.lat, 90);
  assert.strictEqual(result.lon, -180);
});

test('rejects latitude out of range', () => {
  assert.throws(() => parseLocation('91 10'), /latitude/i);
  assert.throws(() => parseLocation('-91 10'), /latitude/i);
});

test('rejects longitude out of range', () => {
  assert.throws(() => parseLocation('59 181'), /longitude/i);
  assert.throws(() => parseLocation('59 -181'), /longitude/i);
});

test('rejects non-numeric coordinates', () => {
  assert.throws(() => parseLocation('abc def'), /Invalid coordinates/);
  assert.throws(() => parseLocation('59.91 foo'), /Invalid coordinates/);
});

test('treats single non-numeric token as place name', () => {
  const result = parseLocation('Oslo');
  assert.strictEqual(result.name, 'Oslo');
  assert.strictEqual(result.lat, undefined);
});

test('two non-numeric tokens are rejected (coordinates expected)', () => {
  assert.throws(() => parseLocation('abc def'), /Invalid coordinates/);
  assert.throws(() => parseLocation('Bergen Vestland'), /Invalid coordinates/);
});

test('missing argument throws', () => {
  assert.throws(() => parseLocation(undefined), /No location/i);
  assert.throws(() => parseLocation('   '), /No location/i);
});

test('parseCoordinates validates ranges', () => {
  assert.throws(() => parseCoordinates('95 0'));
  assert.throws(() => parseCoordinates('0 190'));
  const ok = parseCoordinates('0.5 0.5');
  assert.strictEqual(ok.lat, 0.5);
});
