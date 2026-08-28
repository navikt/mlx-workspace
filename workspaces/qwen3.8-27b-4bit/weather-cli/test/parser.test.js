import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation, collectArgs } from '../lib/parse.js';

test('no argument throws', () => {
  assert.throws(() => parseLocation(undefined), /No location given/);
  assert.throws(() => parseLocation('   '), /No location given/);
});

test('parses coordinates in lat lon order', () => {
  const loc = parseLocation('59.91 10.75');
  assert.deepEqual(loc, { type: 'coords', lat: 59.91, lon: 10.75, displayName: '59.91 10.75' });
});

test('rejects non-numeric coordinate pairs', () => {
  assert.throws(() => parseLocation('abc 10.75'), /Invalid coordinates/);
  assert.throws(() => parseLocation('59.91 xyz'), /Invalid coordinates/);
});

test('rejects out-of-range coordinates', () => {
  assert.throws(() => parseLocation('91 10'), /Invalid coordinates/);
  assert.throws(() => parseLocation('59 181'), /Invalid coordinates/);
  assert.throws(() => parseLocation('-91 10'), /Invalid coordinates/);
});

test('accepts negative coordinates', () => {
  const loc = parseLocation('-45.5 -12.25');
  assert.equal(loc.type, 'coords');
  assert.equal(loc.lat, -45.5);
  assert.equal(loc.lon, -12.25);
});

test('treats single token as a place name', () => {
  const loc = parseLocation('Bergen');
  assert.deepEqual(loc, { type: 'name', displayName: 'Bergen' });
});

test('joins multi-word names', () => {
  const loc = parseLocation('  Stavanger  ');
  assert.deepEqual(loc, { type: 'name', displayName: 'Stavanger' });
});

test('collectArgs merges shell-split coordinate pairs', () => {
  assert.deepEqual(collectArgs(['node', 'weather', '59.91', '10.75']), ['59.91 10.75']);
  assert.deepEqual(collectArgs(['node', 'weather', '59.91', 'abc']), ['59.91', 'abc']);
  assert.deepEqual(collectArgs(['node', 'weather', 'Bergen']), ['Bergen']);
  assert.deepEqual(collectArgs(['node', 'weather']), []);
});

test('parseLocation handles collectArgs output', () => {
  const [arg] = collectArgs(['node', 'weather', '59.91', '10.75']);
  const loc = parseLocation(arg);
  assert.deepEqual(loc, { type: 'coords', lat: 59.91, lon: 10.75, displayName: '59.91 10.75' });
});
