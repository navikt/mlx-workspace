'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parseArgs } = require('../src/parser');

test('no arguments yields kind none', () => {
  assert.deepStrictEqual(parseArgs([]), { kind: 'none' });
});

test('single token is a place name', () => {
  assert.deepStrictEqual(parseArgs(['Oslo']), { kind: 'name', name: 'Oslo' });
});

test('two numeric tokens are coordinates in lat lon order', () => {
  assert.deepStrictEqual(parseArgs(['59.91', '10.75']), { kind: 'coords', lat: 59.91, lon: 10.75 });
});

test('negative coordinates are accepted', () => {
  assert.deepStrictEqual(parseArgs(['-64.5', '-179.9']), { kind: 'coords', lat: -64.5, lon: -179.9 });
});

test('boundary coordinates are accepted', () => {
  assert.deepStrictEqual(parseArgs(['-90', '180']), { kind: 'coords', lat: -90, lon: 180 });
});

test('latitude out of range throws with exit code 1', () => {
  assert.throws(() => parseArgs(['91', '10']), (error) => {
    assert.match(error.message, /Invalid coordinates/);
    assert.strictEqual(error.exitCode, 1);
    return true;
  });
});

test('longitude out of range throws with exit code 1', () => {
  assert.throws(() => parseArgs(['59', '181']), (error) => {
    assert.match(error.message, /Invalid coordinates/);
    assert.strictEqual(error.exitCode, 1);
    return true;
  });
});

test('two tokens that are not a valid coordinate pair are rejected', () => {
  assert.throws(() => parseArgs(['59.91', 'abc']), (error) => {
    assert.match(error.message, /Usage/);
    assert.strictEqual(error.exitCode, 1);
    return true;
  });
});

test('three tokens throw a usage error with exit code 1', () => {
  assert.throws(() => parseArgs(['a', 'b', 'c']), (error) => {
    assert.match(error.message, /Usage/);
    assert.strictEqual(error.exitCode, 1);
    return true;
  });
});
