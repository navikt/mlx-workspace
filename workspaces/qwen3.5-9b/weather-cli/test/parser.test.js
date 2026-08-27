import { describe, it, expect, vi } from 'vitest';
import { parseArgs, parseCoordinates, parseLocationName } from '../parser';

describe('parseArgs', () => {
  it('should return empty object when no args', () => {
    const result = parseArgs([]);
    expect(result).toEqual({ location: undefined });
  });

  it('should parse location argument', () => {
    const result = parseArgs(['node', 'weather-cli.js', 'Oslo']);
    expect(result).toEqual({ location: 'Oslo' });
  });

  it('should parse location argument with special characters', () => {
    const result = parseArgs(['node', 'weather-cli.js', 'Oslo kommune']);
    expect(result).toEqual({ location: 'Oslo kommune' });
  });
});

describe('parseCoordinates', () => {
  it('should parse valid coordinates', () => {
    const result = parseCoordinates('63.4305 10.3951');
    expect(result).toEqual({ lat: 63.4305, lon: 10.3951 });
  });

  it('should parse valid coordinates with decimals', () => {
    const result = parseCoordinates('59.9119 10.7335');
    expect(result).toEqual({ lat: 59.9119, lon: 10.7335 });
  });

  it('should return null for single value', () => {
    const result = parseCoordinates('63.4305');
    expect(result).toBeNull();
  });

  it('should return null for invalid coordinates', () => {
    const result = parseCoordinates('invalid');
    expect(result).toBeNull();
  });

  it('should return null for non-numeric values', () => {
    const result = parseCoordinates('abc def');
    expect(result).toBeNull();
  });

  it('should return null for negative coordinates', () => {
    const result = parseCoordinates('-10 -20');
    expect(result).toBeNull();
  });

  it('should return null for coordinates with extra spaces', () => {
    const result = parseCoordinates('63.4305   10.3951');
    expect(result).toEqual({ lat: 63.4305, lon: 10.3951 });
  });
});

describe('parseLocationName', () => {
  it('should return default coordinates with location name', () => {
    const result = parseLocationName('Oslo');
    expect(result).toEqual({
      lat: 60.32820331378818,
      lon: 5.298175036700542,
      name: 'Oslo'
    });
  });

  it('should return default coordinates with empty string', () => {
    const result = parseLocationName('');
    expect(result).toEqual({
      lat: 60.32820331378818,
      lon: 5.298175036700542,
      name: ''
    });
  });
});
