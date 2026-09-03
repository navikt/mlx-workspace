import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatOutput } from '../output.js';

describe('formatOutput', () => {
  it('formats output with all fields present', () => {
    const data = {
      temperature: 14,
      description: 'Clear',
      humidity: 55,
      windSpeed: 2.2,
      pressure: 1007,
      uvIndex: 1.5,
    };

    const result = formatOutput('Oslo', data);
    const lines = result.split('\n');

    assert.strictEqual(lines[0], 'Weather in Oslo (Met.no API)');
    assert.strictEqual(lines[1], 'Temperature: 14°C');
    assert.strictEqual(lines[2], 'Description: Clear');
    assert.strictEqual(lines[3], 'Humidity: 55%');
    assert.strictEqual(lines[4], 'Wind Speed: 2.2 m/s');
    assert.strictEqual(lines[5], 'Pressure: 1007 hPa');
    assert.strictEqual(lines[6], 'UV Index: 1.5');
    assert.strictEqual(lines.length, 7);
  });

  it('omits description when undefined (trap #5)', () => {
    const data = {
      temperature: 14,
      description: undefined,
      humidity: 55,
      windSpeed: 2.2,
      pressure: 1007,
      uvIndex: 1.5,
    };

    const result = formatOutput('Bergen', data);
    const lines = result.split('\n');

    assert.ok(!lines.some(l => l.startsWith('Description:')));
    assert.strictEqual(lines.length, 6);
  });

  it('omits UV Index when undefined (trap #4)', () => {
    const data = {
      temperature: 14,
      description: 'Clear',
      humidity: 55,
      windSpeed: 2.2,
      pressure: 1007,
      uvIndex: undefined,
    };

    const result = formatOutput('Tromsø', data);
    const lines = result.split('\n');

    assert.ok(!lines.some(l => l.startsWith('UV Index:')));
    assert.strictEqual(lines.length, 6);
  });

  it('omits both description and UV when both undefined', () => {
    const data = {
      temperature: 14,
      description: undefined,
      humidity: 55,
      windSpeed: 2.2,
      pressure: 1007,
      uvIndex: undefined,
    };

    const result = formatOutput('Trondheim', data);
    const lines = result.split('\n');

    assert.ok(!lines.some(l => l.startsWith('Description:')));
    assert.ok(!lines.some(l => l.startsWith('UV Index:')));
    assert.strictEqual(lines.length, 5);
  });

  it('uses correct location name from geocode', () => {
    const data = {
      temperature: 10,
      description: 'Overcast',
      humidity: 80,
      windSpeed: 5,
      pressure: 990,
      uvIndex: 0.5,
    };

    const result = formatOutput('Oslo fylke', data);
    assert.ok(result.startsWith('Weather in Oslo fylke'));
  });

  it('handles negative temperatures', () => {
    const data = {
      temperature: -5,
      description: 'Clear',
      humidity: 90,
      windSpeed: 1,
      pressure: 1020,
      uvIndex: 0,
    };

    const result = formatOutput('Karasjok', data);
    assert.strictEqual(result.split('\n')[1], 'Temperature: -5°C');
  });

  it('handles coordinates display name', () => {
    const data = {
      temperature: 14,
      description: 'Clear',
      humidity: 55,
      windSpeed: 2.2,
      pressure: 1007,
      uvIndex: 1.5,
    };

    const result = formatOutput('(59.91, 10.75)', data);
    assert.ok(result.startsWith('Weather in (59.91, 10.75)'));
  });
});
