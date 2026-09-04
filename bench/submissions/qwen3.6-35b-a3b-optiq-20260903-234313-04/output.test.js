import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatWeather } from './output.js';

describe('formatWeather', () => {
  it('should format weather output correctly', () => {
    const weather = {
      temperature: 15.5,
      description: 'Partly cloudy',
      humidity: 65,
      windSpeed: 3.2,
      pressure: 1012,
      uvIndex: 4,
    };

    const result = formatWeather('Oslo', weather);

    const expected = [
      'Weather in Oslo (Met.no API)',
      'Temperature: 15.5°C',
      'Description: Partly cloudy',
      'Humidity: 65%',
      'Wind Speed: 3.2 m/s',
      'Pressure: 1012 hPa',
      'UV Index: 4',
    ].join('\n');

    assert.equal(result, expected);
  });

  it('should handle integer values', () => {
    const weather = {
      temperature: 15,
      description: 'Clear',
      humidity: 70,
      windSpeed: 2,
      pressure: 1000,
      uvIndex: 3,
    };

    const result = formatWeather('Bergen', weather);

    assert.ok(result.includes('Weather in Bergen (Met.no API)'));
    assert.ok(result.includes('Temperature: 15°C'));
    assert.ok(result.includes('Description: Clear'));
    assert.ok(result.includes('Humidity: 70%'));
    assert.ok(result.includes('Wind Speed: 2 m/s'));
    assert.ok(result.includes('Pressure: 1000 hPa'));
    assert.ok(result.includes('UV Index: 3'));
  });

  it('should handle negative temperature', () => {
    const weather = {
      temperature: -5,
      description: 'Overcast',
      humidity: 90,
      windSpeed: 5.0,
      pressure: 995,
      uvIndex: 0,
    };

    const result = formatWeather('Tromsø', weather);

    assert.ok(result.includes('Temperature: -5°C'));
  });

  it('should include location name in output', () => {
    const weather = {
      temperature: 10,
      description: 'Mostly clear',
      humidity: 55,
      windSpeed: 1.5,
      pressure: 1010,
      uvIndex: 2,
    };

    const result = formatWeather('Trondheim', weather);

    assert.ok(result.startsWith('Weather in Trondheim (Met.no API)'));
  });
});
