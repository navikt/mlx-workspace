import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, isDecimal } from './src/parser.js';

test('no args -> Oslo default', () => {
  const loc = parseArgs([]);
  assert.equal(loc.kind, 'default');
  assert.equal(loc.name, 'Oslo');
  assert.equal(loc.lat, 59.91);
  assert.equal(loc.lon, 10.75);
});

test('two decimals -> coords (lat lon order)', () => {
  const loc = parseArgs(['59.91', '10.75']);
  assert.equal(loc.kind, 'coords');
  assert.equal(loc.lat, 59.91);
  assert.equal(loc.lon, 10.75);
  assert.equal(loc.name, '59.91 10.75');
});

test('negative + integer decimals accepted', () => {
  const loc = parseArgs(['-3.2', '42']);
  assert.equal(loc.kind, 'coords');
  assert.equal(loc.lat, -3.2);
  assert.equal(loc.lon, 42);
});

test('single token -> place name', () => {
  const loc = parseArgs(['Oslo']);
  assert.equal(loc.kind, 'name');
  assert.equal(loc.name, 'Oslo');
});

test('multi-word name -> place name', () => {
  const loc = parseArgs(['Oslo', 'fylke']);
  assert.equal(loc.kind, 'name');
  assert.equal(loc.name, 'Oslo fylke');
});

test('two tokens where one is not a number -> place name', () => {
  const loc = parseArgs(['59.91', 'abc']);
  assert.equal(loc.kind, 'name');
  assert.equal(loc.name, '59.91 abc');
});

test('latitude out of range -> throws', () => {
  assert.throws(() => parseArgs(['91', '10']), /Invalid latitude/);
});

test('longitude out of range -> throws', () => {
  assert.throws(() => parseArgs(['59', '181']), /Invalid longitude/);
});

test('isDecimal', () => {
  assert.ok(isDecimal('59.91'));
  assert.ok(isDecimal('-3.2'));
  assert.ok(isDecimal('42'));
  assert.ok(isDecimal('.5'));
  assert.ok(!isDecimal('abc'));
  assert.ok(!isDecimal('59.91abc'));
  assert.ok(!isDecimal(''));
  assert.ok(!isDecimal(59));
});
