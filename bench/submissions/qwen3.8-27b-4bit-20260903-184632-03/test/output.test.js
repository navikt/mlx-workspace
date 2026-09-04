'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { formatWeather } = require('../src/output');

test('formats output exactly per the spec', () => {
  const out = formatWeather('Oslo', {
    temperature: 19.8,
    description: 'Partly cloudy',
    humidity: 41,
    windSpeed: 3.4,
    pressure: 1003.5,
    uvIndex: 0.5,
  });
  assert.strictEqual(
    out,
    [
      'Weather in Oslo (Met.no API)',
      'Temperature: 19.8°C',
      'Description: Partly cloudy',
      'Humidity: 41%',
      'Wind Speed: 3.4 m/s',
      'Pressure: 1003.5 hPa',
      'UV Index: 0.5',
    ].join('\n')
  );
});

test('handles coordinate display names', () => {
  const out = formatWeather('59.91, 10.75', {
    temperature: -2.1,
    description: 'Clear',
    humidity: 80,
    windSpeed: 1,
    pressure: 1020,
    uvIndex: 0,
  });
  assert.strictEqual(out.split('\n')[0], 'Weather in 59.91, 10.75 (Met.no API)');
  assert.strictEqual(out.split('\n')[1], 'Temperature: -2.1°C');
  assert.strictEqual(out.split('\n')[6], 'UV Index: 0');
});
