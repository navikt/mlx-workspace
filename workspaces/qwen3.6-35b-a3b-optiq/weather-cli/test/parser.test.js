import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation } from '../parser.js';

describe('parser', () => {
  describe('parseLocation', () => {
    it('should return Oslo as default when no argument', () => {
      const result = parseLocation(['node', 'cli.js']);
      assert.equal(result.type, 'name');
      assert.equal(result.name, 'Oslo');
    });

    it('should parse a location name', () => {
      const result = parseLocation(['node', 'cli.js', 'Bergen']);
      assert.equal(result.type, 'name');
      assert.equal(result.name, 'Bergen');
    });

    it('should parse valid coordinates', () => {
      const result = parseLocation(['node', 'cli.js', '59.91 10.75']);
      assert.equal(result.type, 'coordinates');
      assert.equal(result.lat, 59.91);
      assert.equal(result.lon, 10.75);
    });

    it('should parse negative coordinates', () => {
      const result = parseLocation(['node', 'cli.js', '-33.86 151.21']);
      assert.equal(result.type, 'coordinates');
      assert.equal(result.lat, -33.86);
      assert.equal(result.lon, 151.21);
    });

    it('should reject latitude > 90', () => {
      assert.throws(() => parseLocation(['node', 'cli.js', '91 10']), /Invalid latitude/);
    });

    it('should reject latitude < -90', () => {
      assert.throws(() => parseLocation(['node', 'cli.js', '-91 10']), /Invalid latitude/);
    });

    it('should reject longitude > 180', () => {
      assert.throws(() => parseLocation(['node', 'cli.js', '50 181']), /Invalid longitude/);
    });

    it('should reject longitude < -180', () => {
      assert.throws(() => parseLocation(['node', 'cli.js', '50 -181']), /Invalid longitude/);
    });

    it('should treat non-coordinate strings as names', () => {
      const result = parseLocation(['node', 'cli.js', 'Trondheim']);
      assert.equal(result.type, 'name');
      assert.equal(result.name, 'Trondheim');
    });
  });
});
