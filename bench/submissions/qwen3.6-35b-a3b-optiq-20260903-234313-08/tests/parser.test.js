import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { parseArgs } from '../src/parser.js';

describe('Parser', () => {
  let savedArgv;

  beforeEach(() => {
    savedArgv = process.argv;
  });

  afterEach(() => {
    process.argv = savedArgv;
  });

  it('should return default Oslo when no args provided', () => {
    process.argv = ['node', 'weather-cli'];
    const result = parseArgs();
    assert.strictEqual(result.type, 'default');
    assert.strictEqual(result.name, 'Oslo');
  });

  it('should parse location name', () => {
    process.argv = ['node', 'weather-cli', 'Bergen'];
    const result = parseArgs();
    assert.strictEqual(result.type, 'name');
    assert.strictEqual(result.name, 'Bergen');
  });

  it('should trim location name', () => {
    process.argv = ['node', 'weather-cli', '  Bergen  '];
    const result = parseArgs();
    assert.strictEqual(result.type, 'name');
    assert.strictEqual(result.name, 'Bergen');
  });

  it('should parse valid coordinates', () => {
    process.argv = ['node', 'weather-cli', '59.91 10.75'];
    const result = parseArgs();
    assert.strictEqual(result.type, 'coordinates');
    assert.strictEqual(result.lat, 59.91);
    assert.strictEqual(result.lon, 10.75);
  });

  it('should parse coordinates with tab separator', () => {
    process.argv = ['node', 'weather-cli', '59.91\t10.75'];
    const result = parseArgs();
    assert.strictEqual(result.type, 'coordinates');
    assert.strictEqual(result.lat, 59.91);
    assert.strictEqual(result.lon, 10.75);
  });

  it('should reject invalid latitude (out of range)', () => {
    process.argv = ['node', 'weather-cli', '91 10.75'];
    assert.throws(() => parseArgs(), /Invalid latitude/);
  });

  it('should reject invalid longitude (out of range)', () => {
    process.argv = ['node', 'weather-cli', '59.91 181'];
    assert.throws(() => parseArgs(), /Invalid longitude/);
  });

  it('should reject non-numeric coordinates', () => {
    process.argv = ['node', 'weather-cli', 'abc def'];
    assert.throws(() => parseArgs(), /Invalid coordinates/);
  });

  it('should reject single coordinate value', () => {
    process.argv = ['node', 'weather-cli', '59.91'];
    const result = parseArgs();
    assert.strictEqual(result.type, 'name');
    assert.strictEqual(result.name, '59.91');
  });

  it('should reject negative latitude out of range', () => {
    process.argv = ['node', 'weather-cli', '-91 10.75'];
    assert.throws(() => parseArgs(), /Invalid latitude/);
  });

  it('should reject negative longitude out of range', () => {
    process.argv = ['node', 'weather-cli', '59.91 -181'];
    assert.throws(() => parseArgs(), /Invalid longitude/);
  });

  it('should accept boundary latitude values', () => {
    process.argv = ['node', 'weather-cli', '-90 0'];
    let result = parseArgs();
    assert.strictEqual(result.type, 'coordinates');
    assert.strictEqual(result.lat, -90);

    process.argv = ['node', 'weather-cli', '90 0'];
    result = parseArgs();
    assert.strictEqual(result.type, 'coordinates');
    assert.strictEqual(result.lat, 90);
  });

  it('should accept boundary longitude values', () => {
    process.argv = ['node', 'weather-cli', '0 -180'];
    let result = parseArgs();
    assert.strictEqual(result.type, 'coordinates');
    assert.strictEqual(result.lon, -180);

    process.argv = ['node', 'weather-cli', '0 180'];
    result = parseArgs();
    assert.strictEqual(result.type, 'coordinates');
    assert.strictEqual(result.lon, 180);
  });
});
