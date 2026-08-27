import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from './bin/weather.js';

test('name -> geocode -> weather -> format', async () => {
  const geocode = async (name) => {
    assert.equal(name, 'Oslo');
    return { lat: 59.91, lon: 10.73, name: 'Oslo' };
  };
  const fetchWeather = async (lat, lon) => {
    assert.equal(lat, 59.91);
    assert.equal(lon, 10.73);
    return { temperature: 17.3, description: 'Partly cloudy', humidity: 63.2, windSpeed: 2.1, pressure: 1025.3, uvIndex: 1 };
  };
  const out = await run(['Oslo'], { geocode, fetchWeather });
  assert.equal(out, [
    'Weather in Oslo (Met.no API)',
    'Temperature: 17.3°C',
    'Description: Partly cloudy',
    'Humidity: 63.2%',
    'Wind Speed: 2.1 m/s',
    'Pressure: 1025.3 hPa',
    'UV Index: 1',
  ].join('\n'));
});

test('coords skip geocode', async () => {
  let geocodeCalled = false;
  const geocode = async () => { geocodeCalled = true; return { lat: 0, lon: 0, name: 'x' }; };
  const fetchWeather = async (lat, lon) => {
    assert.equal(lat, 59.91);
    assert.equal(lon, 10.75);
    return { temperature: 5, description: 'Clear', humidity: 40, windSpeed: 1, pressure: 1000, uvIndex: 2 };
  };
  const out = await run(['59.91', '10.75'], { geocode, fetchWeather });
  assert.equal(geocodeCalled, false);
  assert.match(out, /^Weather in 59\.91 10\.75 \(Met\.no API\)/);
});

test('geocode failure propagates', async () => {
  const geocode = async () => { throw new Error('No place found for "XYZ" (Geonorge covers Norway only)'); };
  await assert.rejects(() => run(['XYZ'], { geocode, fetchWeather: async () => ({}) }), /No place found/);
});

// Real end-to-end against the live APIs. Skipped unless WEATHER_LIVE=1 (keeps the default suite hermetic).
test('live Oslo', { skip: !process.env.WEATHER_LIVE }, async () => {
  const out = await run(['Oslo']);
  assert.match(out, /^Weather in .+ \(Met\.no API\)$/m);
  assert.match(out, /Temperature: -?\d+(\.\d+)?°C/);
  assert.match(out, /Description: (Overcast|Partly cloudy|Mostly clear|Clear)/);
  assert.match(out, /Humidity: \d+(\.\d+)?%/);
  assert.match(out, /Wind Speed: \d+(\.\d+)? m\/s/);
  assert.match(out, /Pressure: \d+(\.\d+)? hPa/);
  assert.match(out, /UV Index: \d+(\.\d+)?/);
});
