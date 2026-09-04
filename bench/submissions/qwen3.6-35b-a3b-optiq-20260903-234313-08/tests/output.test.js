import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatWeather } from '../src/output.js';

describe('Output', () => {
  it('should format weather output correctly', () => {
    const weather = {
      temperature: 13.7,
      description: 'Overcast',
      humidity: 71.9,
      windSpeed: 0.7,
      pressure: 1002.3,
      uvIndex: 0
    };

    const result = formatWeather('Oslo', weather);
    const expected = [
      'Weather in Oslo (Met.no API)',
      'Temperature: 13.7°C',
      'Description: Overcast',
      'Humidity: 71.9%',
      'Wind Speed: 0.7 m/s',
      'Pressure: 1002.3 hPa',
      'UV Index: 0'
    ].join('\n');

    assert.strictEqual(result, expected);
  });

  it('should include location name in output', () => {
    const weather = {
      temperature: 10,
      description: 'Clear',
      humidity: 50,
      windSpeed: 2,
      pressure: 1013,
      uvIndex: 3
    };

    const result = formatWeather('Bergen', weather);
    assert.match(result, /^Weather in Bergen/);
  });

  it('should include all required fields', () => {
    const weather = {
      temperature: 10,
      description: 'Clear',
      humidity: 50,
      windSpeed: 2,
      pressure: 1013,
      uvIndex: 3
    };

    const result = formatWeather('Test', weather);
    assert.ok(result.includes('Temperature:'));
    assert.ok(result.includes('Description:'));
    assert.ok(result.includes('Humidity:'));
    assert.ok(result.includes('Wind Speed:'));
    assert.ok(result.includes('Pressure:'));
    assert.ok(result.includes('UV Index:'));
  });

  it('should include correct units', () => {
    const weather = {
      temperature: 10,
      description: 'Clear',
      humidity: 50,
      windSpeed: 2,
      pressure: 1013,
      uvIndex: 3
    };

    const result = formatWeather('Test', weather);
    assert.ok(result.includes('°C'));
    assert.ok(result.includes('%'));
    assert.ok(result.includes('m/s'));
    assert.ok(result.includes('hPa'));
  });

  it('should handle decimal values', () => {
    const weather = {
      temperature: 13.7,
      description: 'Partly cloudy',
      humidity: 71.9,
      windSpeed: 0.7,
      pressure: 1002.3,
      uvIndex: 0
    };

    const result = formatWeather('Oslo', weather);
    assert.ok(result.includes('13.7'));
    assert.ok(result.includes('71.9'));
    assert.ok(result.includes('0.7'));
    assert.ok(result.includes('1002.3'));
  });

  it('should output exactly 7 lines', () => {
    const weather = {
      temperature: 10,
      description: 'Clear',
      humidity: 50,
      windSpeed: 2,
      pressure: 1013,
      uvIndex: 3
    };

    const result = formatWeather('Test', weather);
    const lines = result.split('\n');
    assert.strictEqual(lines.length, 7);
  });
});
