import { test } from 'node:test';
import assert from 'node:assert/strict';
import { format } from '../src/output.js';

test('formats exactly per spec', () => {
  const out = format('Oslo', {
    temperature: 15.4,
    description: 'Overcast',
    humidity: 64.8,
    windSpeed: 2.5,
    pressure: 1003.6,
    uvIndex: 0,
  });
  assert.equal(out, [
    'Weather in Oslo (Met.no API)',
    'Temperature: 15.4°C',
    'Description: Overcast',
    'Humidity: 64.8%',
    'Wind Speed: 2.5 m/s',
    'Pressure: 1003.6 hPa',
    'UV Index: 0',
  ].join('\n'));
});

test('uses coordinate string as location name', () => {
  const out = format('59.91 10.75', {
    temperature: 10, description: 'Clear', humidity: 50,
    windSpeed: 1, pressure: 1013, uvIndex: 2,
  });
  assert.match(out, /^Weather in 59\.91 10\.75 \(Met\.no API\)/);
});
