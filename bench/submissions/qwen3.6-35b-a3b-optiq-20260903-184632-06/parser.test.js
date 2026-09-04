import assert from 'node:assert';
import { test } from 'node:test';
import { parseLocation } from './src/parser.js';

test('no argument defaults to Oslo', () => {
  const result = parseLocation(undefined);
  assert.strictEqual(result.type, 'name');
  assert.strictEqual(result.value, 'Oslo');
});

test('location name returns name type', () => {
  const result = parseLocation('Bergen');
  assert.strictEqual(result.type, 'name');
  assert.strictEqual(result.value, 'Bergen');
});

test('coordinates string is parsed correctly', () => {
  const result = parseLocation('59.91 10.75');
  assert.strictEqual(result.type, 'coords');
  assert.strictEqual(result.lat, 59.91);
  assert.strictEqual(result.lon, 10.75);
});

test('negative coordinates are parsed correctly', () => {
  const result = parseLocation('-33.87 151.21');
  assert.strictEqual(result.type, 'coords');
  assert.strictEqual(result.lat, -33.87);
  assert.strictEqual(result.lon, 151.21);
});

test('invalid coordinate format treated as name', () => {
  const result = parseLocation('not coords');
  assert.strictEqual(result.type, 'name');
  assert.strictEqual(result.value, 'not coords');
});

test('extra spaces in coordinates treated as name', () => {
  const result = parseLocation('59.91  10.75');
  assert.strictEqual(result.type, 'name');
  assert.strictEqual(result.value, '59.91  10.75');
});

test('single number is treated as name, not coords', () => {
  const result = parseLocation('42');
  assert.strictEqual(result.type, 'name');
  assert.strictEqual(result.value, '42');
});

test('three numbers is treated as name', () => {
  const result = parseLocation('1 2 3');
  assert.strictEqual(result.type, 'name');
  assert.strictEqual(result.value, '1 2 3');
});

test('location name with spaces is treated as name', () => {
  const result = parseLocation('New York');
  assert.strictEqual(result.type, 'name');
  assert.strictEqual(result.value, 'New York');
});
