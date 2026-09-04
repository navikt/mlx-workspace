'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { formatOutput } = require('./output');

test('formats the spec output block', () => {
  const out = formatOutput('Oslo', {
    temperature: 14,
    description: 'Overcast',
    humidity: 69.7,
    windSpeed: 2.5,
    pressure: 1003,
    uvIndex: 0,
  });
  assert.strictEqual(
    out,
    [
      'Weather in Oslo (Met.no API)',
      'Temperature: 14°C',
      'Description: Overcast',
      'Humidity: 69.7%',
      'Wind Speed: 2.5 m/s',
      'Pressure: 1003 hPa',
      'UV Index: 0',
    ].join('\n')
  );
});
