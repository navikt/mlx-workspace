import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation } from '../src/parse.js';

test('parses valid coordinates', () => {
  const r = parseLocation('59.91 10.75');
  assert.equal(r.type, 'coords');
  assert.equal(r.lat, 59.91);
  assert.equal(r.lon, 10.75);
});

test('parses negative coordinates', () => {
  const r = parseLocation('-45.5 -12.25');
  assert.equal(r.type, 'coords');
  assert.equal(r.lat, -45.5);
  assert.equal(r.lon, -12.25);
});

test('parses integer coordinates', () => {
  const r = parseLocation('60 5');
  assert.equal(r.type, 'coords');
  assert.equal(r.lat, 60);
  assert.equal(r.lon, 5);
});

test('rejects latitude out of range', () => {
  assert.throws(() => parseLocation('91 10'), /invalid latitude/);
});

test('rejects longitude out of range', () => {
  assert.throws(() => parseLocation('60 181'), /invalid longitude/);
});

test('treats non-numeric pair as a name', () => {
  const r = parseLocation('abc def');
  assert.equal(r.type, 'name');
  assert.equal(r.name, 'abc def');
});

test('treats single number as a name, not coords', () => {
  const r = parseLocation('59.91');
  assert.equal(r.type, 'name');
  assert.equal(r.name, '59.91');
});

test('parses place name', () => {
  const r = parseLocation('Bergen');
  assert.equal(r.type, 'name');
  assert.equal(r.name, 'Bergen');
});

test('trims whitespace on names', () => {
  const r = parseLocation('  Oslo  ');
  assert.equal(r.type, 'name');
  assert.equal(r.name, 'Oslo');
});

test('rejects missing location', () => {
  assert.throws(() => parseLocation(undefined), /location required/);
  assert.throws(() => parseLocation(''), /location required/);
  assert.throws(() => parseLocation('   '), /location required/);
});
