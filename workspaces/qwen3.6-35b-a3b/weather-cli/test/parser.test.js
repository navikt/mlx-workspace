import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseArgs } from '../parser.js';

describe('parser.test.js', () => {
  it('returns null location when no args', () => {
    const result = parseArgs([]);
    assert.strictEqual(result.location, null);
  });

  it('parses location name string', () => {
    const result = parseArgs(['Oslo']);
    assert.strictEqual(result.location.type, 'name');
    assert.strictEqual(result.location.value, 'Oslo');
  });

  it('parses coordinates "lat lon"', () => {
    const result = parseArgs(['59.91 10.75']);
    assert.strictEqual(result.location.type, 'coords');
    assert.strictEqual(result.location.value.lat, 59.91);
    assert.strictEqual(result.location.value.lon, 10.75);
  });

  it('parses coordinates passed as separate shell args', () => {
    const result = parseArgs(['59.91', '10.75']);
    assert.strictEqual(result.location.type, 'coords');
    assert.strictEqual(result.location.value.lat, 59.91);
    assert.strictEqual(result.location.value.lon, 10.75);
  });

  it('parses negative coordinates (southern/western hemisphere)', () => {
    const result = parseArgs(['-33.87 151.21']);
    assert.strictEqual(result.location.type, 'coords');
    assert.strictEqual(result.location.value.lat, -33.87);
    assert.strictEqual(result.location.value.lon, 151.21);
  });

  it('throws on invalid latitude (> 90)', () => {
    assert.throws(() => parseArgs(['95 10']), /Invalid latitude/);
  });

  it('throws on invalid longitude (> 180)', () => {
    assert.throws(() => parseArgs(['50 200']), /Invalid longitude/);
  });

  it('trims whitespace from location name', () => {
    const result = parseArgs(['  Bergen  ']);
    assert.strictEqual(result.location.value, 'Bergen');
  });

  it('treats non-coordinate strings as location names', () => {
    const result = parseArgs(['Stortorvet']);
    assert.strictEqual(result.location.type, 'name');
    assert.strictEqual(result.location.value, 'Stortorvet');
  });
});
