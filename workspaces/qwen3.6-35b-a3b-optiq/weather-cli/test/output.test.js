import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatWeather } from '../output.js';

describe('output', () => {
  describe('formatWeather', () => {
    it('should format weather output correctly', () => {
      const weather = {
        temperature: 15,
        description: 'Partly cloudy',
        humidity: 65,
        windSpeed: 3.5,
        pressure: 1013,
        uvIndex: 4,
      };

      const result = formatWeather('Oslo', weather);
      const expected = [
        'Weather in Oslo (Met.no API)',
        'Temperature: 15°C',
        'Description: Partly cloudy',
        'Humidity: 65%',
        'Wind Speed: 3.5 m/s',
        'Pressure: 1013 hPa',
        'UV Index: 4',
      ].join('\n');

      assert.equal(result, expected);
    });

    it('should handle N/A values', () => {
      const weather = {
        temperature: 'N/A',
        description: 'Unknown',
        humidity: 'N/A',
        windSpeed: 'N/A',
        pressure: 'N/A',
        uvIndex: 'N/A',
      };

      const result = formatWeather('Test', weather);
      assert.ok(result.includes('Temperature: N/A°C'));
      assert.ok(result.includes('Description: Unknown'));
      assert.ok(result.includes('UV Index: N/A'));
    });

    it('should include location name in output', () => {
      const weather = {
        temperature: 10,
        description: 'Clear',
        humidity: 50,
        windSpeed: 2,
        pressure: 1000,
        uvIndex: 3,
      };

      const result = formatWeather('Bergen', weather);
      assert.ok(result.startsWith('Weather in Bergen'));
    });
  });
});
