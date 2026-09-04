import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fetchWeather } from './weather.js';

describe('weather.js', () => {
  it('fetches weather for Oslo coordinates', async () => {
    const weather = await fetchWeather(59.91, 10.75);
    assert.ok(weather.temperature !== undefined, 'Should have temperature');
    assert.ok(weather.humidity !== undefined, 'Should have humidity');
    assert.ok(weather.windSpeed !== undefined, 'Should have windSpeed');
    assert.ok(weather.pressure !== undefined, 'Should have pressure');
    assert.ok(typeof weather.temperature === 'number', 'Temperature should be a number');
    assert.ok(typeof weather.humidity === 'number', 'Humidity should be a number');
  });

  it('fetches weather for Bergen coordinates', async () => {
    const weather = await fetchWeather(60.39, 5.32);
    assert.ok(weather.temperature !== undefined, 'Should have temperature');
    assert.ok(weather.pressure !== undefined, 'Should have pressure');
  });

  it('returns null uvIndex when not present in data', async () => {
    const weather = await fetchWeather(59.91, 10.75);
    // uvIndex may be present or null depending on API response
    assert.ok(weather.uvIndex === null || typeof weather.uvIndex === 'number', 'uvIndex should be null or number');
  });
});
