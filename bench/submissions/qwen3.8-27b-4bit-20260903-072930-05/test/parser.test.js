import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation } from '../src/parser.js';

test('no argument defaults to a place name lookup', () => {
  assert.deepEqual(parseLocation(undefined), { kind: 'default' });
  assert.deepEqual(parseLocation('   '), { kind: 'default' });
});

test('valid coordinates are parsed with lat lon order', () => {
  assert.deepEqual(parseLocation('59.91 10.75'), {
    kind: 'coords', lat: 59.91, lon: 10.75, label: '59.91 10.75',
  });
});

test('negative and zero coordinates are valid', () => {
  assert.equal(parseLocation('-45 180').kind, 'coords');
  assert.equal(parseLocation('0 0').kind, 'coords');
});

test('out-of-range numeric pairs are invalid coordinates', () => {
  assert.deepEqual(parseLocation('91 10.75'), { kind: 'invalid' });
  assert.deepEqual(parseLocation('59.91 181'), { kind: 'invalid' });
  assert.deepEqual(parseLocation('-90.5 0'), { kind: 'invalid' });
});

test('non-numeric pairs are treated as names', () => {
  assert.deepEqual(parseLocation('Bergen'), { kind: 'name', name: 'Bergen' });
  assert.deepEqual(parseLocation('a b'), { kind: 'name', name: 'a b' });
});
