import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatWeather } from '../src/output.js';

describe('Output', () => {
  it('should format weather data correctly', () => {
    const weather = {
      temperature: 13.8,
      description: 'Partly cloudy',
      humidity: 70.6,
      windSpeed: 1.6,
      pressure: 1002.6,
      uvIndex: 2.5,
    };

    const result = formatWeather('Oslo', weather);
    const expected = [
      'Weather in Oslo (Met.no API)',
      'Temperature: 13.8°C',
      'Description: Partly cloudy',
      'Humidity: 70.6%',
      'Wind Speed: 1.6 m/s',
      'Pressure: 1002.6 hPa',
      'UV Index: 2.5',
    ].join('\n');

    assert.strictEqual(result, expected);
  });

  it('should format with whole number temperatures', () => {
    const weather = {
      temperature: 10,
      description: 'Clear',
      humidity: 80,
      windSpeed: 3,
      pressure: 1000,
      uvIndex: 1,
    };

    const result = formatWeather('Bergen', weather);
    const expected = [
      'Weather in Bergen (Met.no API)',
      'Temperature: 10.0°C',
      'Description: Clear',
      'Humidity: 80.0%',
      'Wind Speed: 3.0 m/s',
      'Pressure: 1000.0 hPa',
      'UV Index: 1.0',
    ].join('\n');

    assert.strictEqual(result, expected);
  });

  it('should format with negative temperature', () => {
    const weather = {
      temperature: -5.3,
      description: 'Overcast',
      humidity: 95.2,
      windSpeed: 4.1,
      pressure: 998.7,
      uvIndex: 0.2,
    };

    const result = formatWeather('Tromsø', weather);
    const expected = [
      'Weather in Tromsø (Met.no API)',
      'Temperature: -5.3°C',
      'Description: Overcast',
      'Humidity: 95.2%',
      'Wind Speed: 4.1 m/s',
      'Pressure: 998.7 hPa',
      'UV Index: 0.2',
    ].join('\n');

    assert.strictEqual(result, expected);
  });

  it('should output exactly 7 lines', () => {
    const weather = {
      temperature: 10,
      description: 'Clear',
      humidity: 50,
      windSpeed: 1,
      pressure: 1013,
      uvIndex: 3,
    };

    const result = formatWeather('Test', weather);
    const lines = result.split('\n');

    assert.strictEqual(lines.length, 7);
    assert.ok(lines[0].startsWith('Weather in'));
    assert.ok(lines[1].startsWith('Temperature:'));
    assert.ok(lines[2].startsWith('Description:'));
    assert.ok(lines[3].startsWith('Humidity:'));
    assert.ok(lines[4].startsWith('Wind Speed:'));
    assert.ok(lines[5].startsWith('Pressure:'));
    assert.ok(lines[6].startsWith('UV Index:'));
  });

  it('should include (Met.no API) in header', () => {
    const weather = {
      temperature: 10,
      description: 'Clear',
      humidity: 50,
      windSpeed: 1,
      pressure: 1013,
      uvIndex: 3,
    };

    const result = formatWeather('Oslo', weather);
    assert.ok(result.startsWith('Weather in Oslo (Met.no API)'));
  });
});
