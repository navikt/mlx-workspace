import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatWeather } from '../lib/output.js';

test('formats the spec output block', () => {
  const out = formatWeather('Oslo', {
    temperature: 17.2,
    description: 'Overcast',
    humidity: 74.3,
    windSpeed: 4.9,
    pressure: 1016.3,
    uvIndex: 3.1,
  });
  assert.equal(
    out,
    [
      'Weather in Oslo (Met.no API)',
      'Temperature: 17.2°C',
      'Description: Overcast',
      'Humidity: 74.3%',
      'Wind Speed: 4.9 m/s',
      'Pressure: 1016.3 hPa',
      'UV Index: 3.1',
    ].join('\n')
  );
});

test('includes coordinate display names', () => {
  const out = formatWeather('59.91 10.75', {
    temperature: 18.0,
    description: 'Clear',
    humidity: 71.4,
    windSpeed: 4.9,
    pressure: 1014.9,
    uvIndex: 3.4,
  });
  assert.ok(out.startsWith('Weather in 59.91 10.75 (Met.no API)'));
});
