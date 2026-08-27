import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatWeather } from './src/output.js';

test('renders the exact spec format', () => {
  const out = formatWeather('Oslo', {
    temperature: 17.3, description: 'Partly cloudy', humidity: 63.2,
    windSpeed: 2.1, pressure: 1025.3, uvIndex: 1,
  });
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

test('decimal uv index preserved', () => {
  const out = formatWeather('59.91 10.75', {
    temperature: 5, description: 'Clear', humidity: 40,
    windSpeed: 1, pressure: 1000, uvIndex: 2.5,
  });
  assert.match(out, /^Weather in 59\.91 10\.75 \(Met\.no API\)/);
  assert.match(out, /UV Index: 2\.5/);
});
