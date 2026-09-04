'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseLocation } = require('./parser');

test('parses coordinates "lat lon"', () => {
  const loc = parseLocation(['59.91', '10.75']);
  assert.strictEqual(loc.type, 'coords');
  assert.strictEqual(loc.lat, 59.91);
  assert.strictEqual(loc.lon, 10.75);
});

test('parses multi-word coordinate input', () => {
  const loc = parseLocation(['59.91 10.75']);
  assert.strictEqual(loc.type, 'coords');
  assert.strictEqual(loc.lat, 59.91);
  assert.strictEqual(loc.lon, 10.75);
});

test('parses a place name', () => {
  const loc = parseLocation(['Oslo']);
  assert.strictEqual(loc.type, 'name');
  assert.strictEqual(loc.name, 'Oslo');
});

test('parses multi-word place name', () => {
  const loc = parseLocation(['Trondheim', 'Sund']);
  assert.strictEqual(loc.type, 'name');
  assert.strictEqual(loc.name, 'Trondheim Sund');
});

test('treats non-numeric two-token input as a place name', () => {
  const loc = parseLocation(['abc', 'def']);
  assert.strictEqual(loc.type, 'name');
  assert.strictEqual(loc.name, 'abc def');
});

test('rejects out-of-range latitude', () => {
  assert.throws(() => parseLocation(['95', '10']), /out of range/);
});

test('rejects out-of-range longitude', () => {
  assert.throws(() => parseLocation(['10', '185']), /out of range/);
});

test('rejects empty input', () => {
  assert.throws(() => parseLocation([]), /Missing location/);
  assert.throws(() => parseLocation(['   ']), /Missing location/);
});
