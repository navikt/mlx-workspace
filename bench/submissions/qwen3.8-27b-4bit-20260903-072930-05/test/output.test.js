import test from 'node:test';
import assert from 'node:assert/strict';
import { describeClouds } from '../src/describe.js';
import { formatWeather } from '../src/output.js';

test('cloud threshold boundaries use strict greater-than', () => {
  assert.equal(describeClouds(75), 'Partly cloudy');
  assert.equal(describeClouds(75.1), 'Overcast');
  assert.equal(describeClouds(50), 'Mostly clear');
  assert.equal(describeClouds(50.1), 'Partly cloudy');
  assert.equal(describeClouds(25), 'Clear');
  assert.equal(describeClouds(25.1), 'Mostly clear');
  assert.equal(describeClouds(0), 'Clear');
  assert.equal(describeClouds(100), 'Overcast');
});

test('formats the full spec output', () => {
  const out = formatWeather({
    locationName: 'Oslo',
    details: {
      air_temperature: 12.6,
      relative_humidity: 64.7,
      cloud_area_fraction: 12.7,
      wind_speed: 0.7,
      air_pressure_at_sea_level: 1007.1,
    },
    hasUv: true,
    uv: 0.3,
  });
  assert.equal(out, [
    'Weather in Oslo (Met.no API)',
    'Temperature: 12.6°C',
    'Description: Clear',
    'Humidity: 64.7%',
    'Wind Speed: 0.7 m/s',
    'Pressure: 1007.1 hPa',
    'UV Index: 0.3',
  ].join('\n'));
});

test('omits the UV line when UV data is absent', () => {
  const out = formatWeather({
    locationName: '59.91 10.75',
    details: {
      air_temperature: 12.6,
      relative_humidity: 64.7,
      cloud_area_fraction: 80,
      wind_speed: 0.7,
      air_pressure_at_sea_level: 1007.1,
    },
    hasUv: false,
    uv: undefined,
  });
  assert.doesNotMatch(out, /UV Index/);
  assert.match(out, /Description: Overcast/);
  assert.match(out, /Weather in 59\.91 10\.75 \(Met\.no API\)/);
});
