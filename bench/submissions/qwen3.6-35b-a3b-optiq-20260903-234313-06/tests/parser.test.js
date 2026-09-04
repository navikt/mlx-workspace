import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseLocation } from '../src/parser.js';

describe('Parser', () => {
  describe('location names', () => {
    it('should parse a simple location name', () => {
      const result = parseLocation('Oslo');
      assert.strictEqual(result.type, 'name');
      assert.strictEqual(result.name, 'Oslo');
    });

    it('should parse a location name with spaces', () => {
      const result = parseLocation('New York');
      assert.strictEqual(result.type, 'name');
      assert.strictEqual(result.name, 'New York');
    });

    it('should trim whitespace from location name', () => {
      const result = parseLocation('  Oslo  ');
      assert.strictEqual(result.type, 'name');
      assert.strictEqual(result.name, 'Oslo');
    });
  });

  describe('coordinates', () => {
    it('should parse positive coordinates', () => {
      const result = parseLocation('59.91 10.75');
      assert.strictEqual(result.type, 'coords');
      assert.strictEqual(result.lat, 59.91);
      assert.strictEqual(result.lon, 10.75);
    });

    it('should parse negative coordinates', () => {
      const result = parseLocation('-33.86 151.20');
      assert.strictEqual(result.type, 'coords');
      assert.strictEqual(result.lat, -33.86);
      assert.strictEqual(result.lon, 151.20);
    });

    it('should parse integer coordinates', () => {
      const result = parseLocation('45 90');
      assert.strictEqual(result.type, 'coords');
      assert.strictEqual(result.lat, 45);
      assert.strictEqual(result.lon, 90);
    });

    it('should parse coordinates with extra spaces', () => {
      const result = parseLocation('59.91   10.75');
      assert.strictEqual(result.type, 'coords');
      assert.strictEqual(result.lat, 59.91);
      assert.strictEqual(result.lon, 10.75);
    });
  });

  describe('validation', () => {
    it('should throw for missing argument', () => {
      assert.throws(() => parseLocation(''), /Location argument is required/);
    });

    it('should throw for undefined argument', () => {
      assert.throws(() => parseLocation(undefined), /Location argument is required/);
    });

    it('should throw for null argument', () => {
      assert.throws(() => parseLocation(null), /Location argument is required/);
    });

    it('should throw for invalid latitude (too high)', () => {
      assert.throws(() => parseLocation('91 10'), /Invalid latitude/);
    });

    it('should throw for invalid latitude (too low)', () => {
      assert.throws(() => parseLocation('-91 10'), /Invalid latitude/);
    });

    it('should throw for invalid longitude (too high)', () => {
      assert.throws(() => parseLocation('59 181'), /Invalid longitude/);
    });

    it('should throw for invalid longitude (too low)', () => {
      assert.throws(() => parseLocation('59 -181'), /Invalid longitude/);
    });

    it('should accept boundary latitude 90', () => {
      const result = parseLocation('90 0');
      assert.strictEqual(result.type, 'coords');
      assert.strictEqual(result.lat, 90);
    });

    it('should accept boundary latitude -90', () => {
      const result = parseLocation('-90 0');
      assert.strictEqual(result.type, 'coords');
      assert.strictEqual(result.lat, -90);
    });

    it('should accept boundary longitude 180', () => {
      const result = parseLocation('0 180');
      assert.strictEqual(result.type, 'coords');
      assert.strictEqual(result.lon, 180);
    });

    it('should accept boundary longitude -180', () => {
      const result = parseLocation('0 -180');
      assert.strictEqual(result.type, 'coords');
      assert.strictEqual(result.lon, -180);
    });
  });

  describe('edge cases', () => {
    it('should treat single number as location name, not coords', () => {
      const result = parseLocation('42');
      assert.strictEqual(result.type, 'name');
      assert.strictEqual(result.name, '42');
    });

    it('should treat three numbers as location name, not coords', () => {
      const result = parseLocation('59 10 20');
      assert.strictEqual(result.type, 'name');
      assert.strictEqual(result.name, '59 10 20');
    });

    it('should treat non-numeric string as location name', () => {
      const result = parseLocation('abc def');
      assert.strictEqual(result.type, 'name');
      assert.strictEqual(result.name, 'abc def');
    });
  });
});
