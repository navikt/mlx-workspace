import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocode } from './geocode.js';
import { fetchWeather } from './fetchWeather.js';
import { formatWeather } from './format.js';

test('end-to-end: Bergen via real APIs', { timeout: 30000 }, async () => {
  const loc = await geocode('Bergen');
  assert.ok(loc.lat > 58 && loc.lat < 62, `lat in Norway: ${loc.lat}`);
  assert.ok(loc.lon > 4 && loc.lon < 13, `lon in Norway: ${loc.lon}`);
  const details = await fetchWeather(loc.lat, loc.lon);
  const out = formatWeather(loc.name, details);
  assert.match(out, /^Weather in .* \(Met\.no API\)$/m);
  assert.match(out, /Temperature: -?\d+(\.\d+)?°C/);
  assert.match(out, /Description: (Clear|Mostly clear|Partly cloudy|Overcast)/);
  assert.match(out, /Humidity: \d+(\.\d+)?%/);
  assert.match(out, /Wind Speed: \d+(\.\d+)? m\/s/);
  assert.match(out, /Pressure: \d+(\.\d+)? hPa/);
  assert.match(out, /UV Index: \d+(\.\d+)?/);
});
