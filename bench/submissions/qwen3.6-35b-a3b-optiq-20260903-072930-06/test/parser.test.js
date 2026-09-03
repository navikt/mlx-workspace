import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation } from '../parser.js';

describe('parseLocation', () => {
  describe('name inputs', () => {
    it('defaults to Oslo when input is empty', () => {
      const result = parseLocation('');
      assert.strictEqual(result.type, 'name');
      assert.strictEqual(result.name, 'Oslo');
    });

    it('defaults to Oslo when input is undefined', () => {
      const result = parseLocation(undefined);
      assert.strictEqual(result.type, 'name');
      assert.strictEqual(result.name, 'Oslo');
    });

    it('returns name for a simple city name', () => {
      const result = parseLocation('Bergen');
      assert.strictEqual(result.type, 'name');
      assert.strictEqual(result.name, 'Bergen');
    });

    it('trims whitespace from name input', () => {
      const result = parseLocation('  Oslo  ');
      assert.strictEqual(result.type, 'name');
      assert.strictEqual(result.name, 'Oslo');
    });
  });

  describe('coordinate inputs', () => {
    it('parses positive coordinates', () => {
      const result = parseLocation('59.91 10.75');
      assert.strictEqual(result.type, 'coordinates');
      assert.strictEqual(result.lat, 59.91);
      assert.strictEqual(result.lon, 10.75);
    });

    it('parses negative coordinates (southern hemisphere)', () => {
      const result = parseLocation('-33.87 151.21');
      assert.strictEqual(result.type, 'coordinates');
      assert.strictEqual(result.lat, -33.87);
      assert.strictEqual(result.lon, 151.21);
    });

    it('parses zero coordinates', () => {
      const result = parseLocation('0 0');
      assert.strictEqual(result.type, 'coordinates');
      assert.strictEqual(result.lat, 0);
      assert.strictEqual(result.lon, 0);
    });

    it('parses coordinates with extra spaces', () => {
      const result = parseLocation('59.91   10.75');
      assert.strictEqual(result.type, 'coordinates');
      assert.strictEqual(result.lat, 59.91);
      assert.strictEqual(result.lon, 10.75);
    });
  });

  describe('validation', () => {
    it('throws for latitude > 90', () => {
      assert.throws(() => parseLocation('91 10'), /Invalid latitude/);
    });

    it('throws for latitude < -90', () => {
      assert.throws(() => parseLocation('-91 10'), /Invalid latitude/);
    });

    it('throws for longitude > 180', () => {
      assert.throws(() => parseLocation('59 181'), /Invalid longitude/);
    });

    it('throws for longitude < -180', () => {
      assert.throws(() => parseLocation('59 -181'), /Invalid longitude/);
    });

    it('treats non-numeric input as a name (not coordinates)', () => {
      const result = parseLocation('abc def');
      assert.strictEqual(result.type, 'name');
      assert.strictEqual(result.name, 'abc def');
    });

    it('does not treat single number as coordinates', () => {
      const result = parseLocation('59');
      assert.strictEqual(result.type, 'name');
      assert.strictEqual(result.name, '59');
    });
  });

  describe('edge cases for trap #2 (boundary at exactly 75)', () => {
    it('treats lat=90 as valid (boundary)', () => {
      const result = parseLocation('90 0');
      assert.strictEqual(result.type, 'coordinates');
      assert.strictEqual(result.lat, 90);
    });

    it('treats lat=-90 as valid (boundary)', () => {
      const result = parseLocation('-90 0');
      assert.strictEqual(result.type, 'coordinates');
      assert.strictEqual(result.lat, -90);
    });

    it('treats lon=180 as valid (boundary)', () => {
      const result = parseLocation('0 180');
      assert.strictEqual(result.type, 'coordinates');
      assert.strictEqual(result.lon, 180);
    });

    it('treats lon=-180 as valid (boundary)', () => {
      const result = parseLocation('0 -180');
      assert.strictEqual(result.type, 'coordinates');
      assert.strictEqual(result.lon, -180);
    });
  });
});
