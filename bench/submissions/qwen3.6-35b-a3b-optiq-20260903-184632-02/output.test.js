import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDescription, formatWeather } from './output.js';

describe('output.js', () => {
  describe('getDescription', () => {
    it('returns "Overcast" for exactly 75% cloud cover', () => {
      assert.strictEqual(getDescription(75), 'Overcast');
    });

    it('returns "Overcast" for above 75%', () => {
      assert.strictEqual(getDescription(80), 'Overcast');
      assert.strictEqual(getDescription(100), 'Overcast');
    });

    it('returns "Partly cloudy" for above 50% and below 75%', () => {
      assert.strictEqual(getDescription(74.9), 'Partly cloudy');
      assert.strictEqual(getDescription(60), 'Partly cloudy');
      assert.strictEqual(getDescription(51), 'Partly cloudy');
    });

    it('returns "Mostly clear" for above 25% and at or below 50%', () => {
      assert.strictEqual(getDescription(26), 'Mostly clear');
      assert.strictEqual(getDescription(25.1), 'Mostly clear');
    });

    it('returns "Mostly clear" for exactly 25% (not > 25, so falls to Clear)', () => {
      assert.strictEqual(getDescription(25), 'Clear');
    });

    it('returns "Partly cloudy" for exactly 50% (not > 50, so falls to Mostly clear)', () => {
      assert.strictEqual(getDescription(50), 'Mostly clear');
    });

    it('returns "Clear" for 25% and below', () => {
      assert.strictEqual(getDescription(20), 'Clear');
      assert.strictEqual(getDescription(0), 'Clear');
    });

    it('returns "N/A" for null cloud fraction', () => {
      assert.strictEqual(getDescription(null), 'N/A');
    });

    it('returns "N/A" for undefined cloud fraction', () => {
      assert.strictEqual(getDescription(undefined), 'N/A');
    });
  });

  describe('formatWeather', () => {
    it('formats complete weather data', () => {
      const weather = {
        temperature: 18.5,
        humidity: 65,
        windSpeed: 3.2,
        pressure: 1013.2,
        uvIndex: 5,
        cloudAreaFraction: 40,
        time: '2026-09-03T16:00:00Z',
      };

      const output = formatWeather(weather, 'Oslo');
      assert.ok(output.includes('Weather in Oslo (Met.no API)'), 'Should include location header');
      assert.ok(output.includes('Temperature: 18.5°C'), 'Should include temperature');
      assert.ok(output.includes('Description: Mostly clear'), 'Should include description');
      assert.ok(output.includes('Humidity: 65%'), 'Should include humidity');
      assert.ok(output.includes('Wind Speed: 3.2 m/s'), 'Should include wind speed');
      assert.ok(output.includes('Pressure: 1013.2 hPa'), 'Should include pressure');
      assert.ok(output.includes('UV Index: 5'), 'Should include UV index');
    });

    it('formats with null uvIndex as "N/A"', () => {
      const weather = {
        temperature: 18.5,
        humidity: 65,
        windSpeed: 3.2,
        pressure: 1013.2,
        uvIndex: null,
        cloudAreaFraction: 40,
        time: '2026-09-03T16:00:00Z',
      };

      const output = formatWeather(weather, 'Oslo');
      assert.ok(output.includes('UV Index: N/A'), 'Should show N/A for null uvIndex');
    });

    it('formats with null cloudAreaFraction as "N/A"', () => {
      const weather = {
        temperature: 18.5,
        humidity: 65,
        windSpeed: 3.2,
        pressure: 1013.2,
        uvIndex: 5,
        cloudAreaFraction: null,
        time: '2026-09-03T16:00:00Z',
      };

      const output = formatWeather(weather, 'Oslo');
      assert.ok(output.includes('Description: N/A'), 'Should show N/A for null cloud fraction');
    });

    it('formats with Overcast description', () => {
      const weather = {
        temperature: 12,
        humidity: 80,
        windSpeed: 5,
        pressure: 1005,
        uvIndex: 1,
        cloudAreaFraction: 85,
        time: '2026-09-03T16:00:00Z',
      };

      const output = formatWeather(weather, 'Bergen');
      assert.ok(output.includes('Description: Overcast'), 'Should show Overcast for high cloud cover');
    });

    it('formats with Clear description', () => {
      const weather = {
        temperature: 22,
        humidity: 30,
        windSpeed: 1.5,
        pressure: 1020,
        uvIndex: 7,
        cloudAreaFraction: 10,
        time: '2026-09-03T16:00:00Z',
      };

      const output = formatWeather(weather, 'Tromsø');
      assert.ok(output.includes('Description: Clear'), 'Should show Clear for low cloud cover');
    });
  });
});
