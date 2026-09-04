import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation } from './parser.js';

describe('parseLocation', () => {
  it('should parse a location name', () => {
    const result = parseLocation('Oslo');
    assert.equal(result.type, 'name');
    assert.equal(result.name, 'Oslo');
  });

  it('should parse a location name with extra whitespace', () => {
    const result = parseLocation('  Bergen  ');
    assert.equal(result.type, 'name');
    assert.equal(result.name, 'Bergen');
  });

  it('should parse positive coordinates', () => {
    const result = parseLocation('59.91 10.75');
    assert.equal(result.type, 'coords');
    assert.equal(result.lat, 59.91);
    assert.equal(result.lon, 10.75);
  });

  it('should parse negative coordinates', () => {
    const result = parseLocation('-33.86 151.21');
    assert.equal(result.type, 'coords');
    assert.equal(result.lat, -33.86);
    assert.equal(result.lon, 151.21);
  });

  it('should parse integer coordinates', () => {
    const result = parseLocation('50 10');
    assert.equal(result.type, 'coords');
    assert.equal(result.lat, 50);
    assert.equal(result.lon, 10);
  });

  it('should parse coordinates with multiple spaces', () => {
    const result = parseLocation('59.91   10.75');
    assert.equal(result.type, 'coords');
    assert.equal(result.lat, 59.91);
    assert.equal(result.lon, 10.75);
  });

  it('should throw for missing input', () => {
    assert.throws(() => parseLocation(), Error);
    assert.throws(() => parseLocation(null), Error);
    assert.throws(() => parseLocation(undefined), Error);
  });

  it('should throw for invalid latitude (too high)', () => {
    assert.throws(() => parseLocation('91 10'), Error);
  });

  it('should throw for invalid latitude (too low)', () => {
    assert.throws(() => parseLocation('-91 10'), Error);
  });

  it('should throw for invalid longitude (too high)', () => {
    assert.throws(() => parseLocation('50 181'), Error);
  });

  it('should throw for invalid longitude (too low)', () => {
    assert.throws(() => parseLocation('50 -181'), Error);
  });

  it('should treat single number as name', () => {
    const result = parseLocation('59');
    assert.equal(result.type, 'name');
    assert.equal(result.name, '59');
  });

  it('should treat three numbers as name', () => {
    const result = parseLocation('59 10 20');
    assert.equal(result.type, 'name');
    assert.equal(result.name, '59 10 20');
  });
});
