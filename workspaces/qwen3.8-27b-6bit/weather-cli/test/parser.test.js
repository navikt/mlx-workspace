import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/parser.js';

test('parses a place name', () => {
  assert.deepEqual(parseArgs(['Oslo']), { type: 'name', name: 'Oslo' });
});

test('parses a multi-word place name', () => {
  assert.deepEqual(parseArgs(['Stavanger', 'sentrum']), {
    type: 'name',
    name: 'Stavanger sentrum',
  });
});

test('parses valid coordinates in lat lon order', () => {
  assert.deepEqual(parseArgs(['59.91', '10.75']), {
    type: 'coords',
    lat: 59.91,
    lon: 10.75,
  });
});

test('rejects out-of-range coordinates', () => {
  assert.throws(() => parseArgs(['91', '10.75']), /Invalid coordinates/);
  assert.throws(() => parseArgs(['-91', '10.75']), /Invalid coordinates/);
  assert.throws(() => parseArgs(['59.91', '181']), /Invalid coordinates/);
  assert.throws(() => parseArgs(['59.91', '-181']), /Invalid coordinates/);
});

test('treats non-numeric two-word input as a place name', () => {
  assert.deepEqual(parseArgs(['abc', '10.75']), { type: 'name', name: 'abc 10.75' });
});

test('rejects missing location', () => {
  assert.throws(() => parseArgs([]), /Usage/);
});
