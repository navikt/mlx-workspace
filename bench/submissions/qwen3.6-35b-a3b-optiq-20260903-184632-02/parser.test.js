import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseLocation } from './parser.js';

describe('parser.js', () => {
  describe('parseLocation', () => {
    it('parses valid coordinates "59.91 10.75"', () => {
      const result = parseLocation('59.91 10.75');
      assert.strictEqual(result.lat, 59.91);
      assert.strictEqual(result.lon, 10.75);
      assert.strictEqual(result.name, '59.91 10.75');
    });

    it('parses negative coordinates "-33.86 151.20"', () => {
      const result = parseLocation('-33.86 151.20');
      assert.strictEqual(result.lat, -33.86);
      assert.strictEqual(result.lon, 151.20);
    });

    it('parses coordinates with varying decimal places "59.9 10.734"', () => {
      const result = parseLocation('59.9 10.734');
      assert.strictEqual(result.lat, 59.9);
      assert.strictEqual(result.lon, 10.734);
    });

    it('throws on empty string', () => {
      assert.throws(() => parseLocation(''), Error);
    });

    it('throws on null input', () => {
      assert.throws(() => parseLocation(null), Error);
    });

    it('returns name only for plain location string "Oslo"', () => {
      const result = parseLocation('Oslo');
      assert.strictEqual(result.lat, undefined);
      assert.strictEqual(result.lon, undefined);
      assert.strictEqual(result.name, 'Oslo');
    });

    it('throws on latitude out of range (91.0)', () => {
      assert.throws(() => parseLocation('91.0 10.0'), Error);
    });

    it('throws on longitude out of range (181.0)', () => {
      assert.throws(() => parseLocation('59.0 181.0'), Error);
    });

    it('treats single number without space as location name', () => {
      const result = parseLocation('59.91');
      assert.strictEqual(result.lat, undefined);
      assert.strictEqual(result.lon, undefined);
      assert.strictEqual(result.name, '59.91');
    });

    it('treats non-numeric "words" as location name', () => {
      const result = parseLocation('abc def');
      assert.strictEqual(result.lat, undefined);
      assert.strictEqual(result.lon, undefined);
      assert.strictEqual(result.name, 'abc def');
    });
  });
});
