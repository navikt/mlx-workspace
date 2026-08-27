import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation } from './parseArgs.js';

test('no input → default', () => {
  assert.deepEqual(parseLocation(''), { kind: 'default' });
  assert.deepEqual(parseLocation('   '), { kind: 'default' });
});

test('place name', () => {
  assert.deepEqual(parseLocation('Oslo'), { kind: 'name', name: 'Oslo' });
  assert.deepEqual(parseLocation('Bergen sentrum'), { kind: 'name', name: 'Bergen sentrum' });
});

test('coordinates lat lon', () => {
  assert.deepEqual(parseLocation('59.91 10.75'), { kind: 'coords', lat: 59.91, lon: 10.75 });
  assert.deepEqual(parseLocation('-59.91 -10.75'), { kind: 'coords', lat: -59.91, lon: -10.75 });
});

test('invalid coordinates → throw', () => {
  assert.throws(() => parseLocation('91 10'), /Invalid latitude/);
  assert.throws(() => parseLocation('-91 10'), /Invalid latitude/);
  assert.throws(() => parseLocation('10 181'), /Invalid longitude/);
});

test('non-numeric tokens → name', () => {
  assert.deepEqual(parseLocation('abc def'), { kind: 'name', name: 'abc def' });
  assert.deepEqual(parseLocation('59.91'), { kind: 'name', name: '59.91' });
});
