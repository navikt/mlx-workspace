import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation } from '../src/parser.js';

describe('parseLocation', () => {
  it('returns null when no args provided', () => {
    const result = parseLocation([]);
    assert.equal(result, null);
  });

  it('returns null when empty string provided', () => {
    const result = parseLocation(['']);
    assert.equal(result, null);
  });

  it('parses Norwegian place name', () => {
    const result = parseLocation(['Oslo']);
    assert.deepEqual(result, { type: 'name', name: 'Oslo' });
  });

  it('parses Norwegian place name with extra whitespace', () => {
    const result = parseLocation(['  Bergen  ']);
    assert.deepEqual(result, { type: 'name', name: 'Bergen' });
  });

  it('parses coordinates as "lat lon"', () => {
    const result = parseLocation(['59.91 10.75']);
    assert.deepEqual(result, { type: 'coordinates', lat: 59.91, lon: 10.75 });
  });

  it('parses integer coordinates', () => {
    const result = parseLocation(['60 11']);
    assert.deepEqual(result, { type: 'coordinates', lat: 60, lon: 11 });
  });

  it('parses negative coordinates (southern hemisphere)', () => {
    const result = parseLocation(['-33.87 151.21']);
    assert.deepEqual(result, { type: 'coordinates', lat: -33.87, lon: 151.21 });
  });

  it('parses coordinates with multiple spaces', () => {
    const result = parseLocation(['59.91   10.75']);
    assert.deepEqual(result, { type: 'coordinates', lat: 59.91, lon: 10.75 });
  });

  it('rejects single number as coordinates (treats as name)', () => {
    const result = parseLocation(['59.91']);
    assert.deepEqual(result, { type: 'name', name: '59.91' });
  });

  it('rejects non-numeric coordinate values', () => {
    const result = parseLocation(['abc 10.75']);
    assert.deepEqual(result, { type: 'name', name: 'abc 10.75' });
  });

  it('rejects out-of-range latitude', () => {
    const result = parseLocation(['91 10.75']);
    assert.deepEqual(result, { type: 'name', name: '91 10.75' });
  });

  it('rejects out-of-range longitude', () => {
    const result = parseLocation(['59.91 181']);
    assert.deepEqual(result, { type: 'name', name: '59.91 181' });
  });

  it('rejects three numbers (not valid coordinates)', () => {
    const result = parseLocation(['59.91 10.75 100']);
    assert.deepEqual(result, { type: 'name', name: '59.91 10.75 100' });
  });

  it('treats coordinates string as name when three parts', () => {
    const result = parseLocation(['59.91 10.75 100']);
    assert.equal(result.type, 'name');
  });
});
