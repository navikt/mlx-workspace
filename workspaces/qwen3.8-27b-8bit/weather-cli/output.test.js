import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudDescription, formatWeather } from './format.js';

test('cloud thresholds (strict >)', () => {
  assert.equal(cloudDescription(100), 'Overcast');
  assert.equal(cloudDescription(75.1), 'Overcast');
  assert.equal(cloudDescription(75), 'Partly cloudy');
  assert.equal(cloudDescription(50.1), 'Partly cloudy');
  assert.equal(cloudDescription(50), 'Mostly clear');
  assert.equal(cloudDescription(25.1), 'Mostly clear');
  assert.equal(cloudDescription(25), 'Clear');
  assert.equal(cloudDescription(0), 'Clear');
});

test('output matches spec format', () => {
  const d = {
    air_temperature: 22.3,
    relative_humidity: 46.5,
    wind_speed: 2.8,
    air_pressure_at_sea_level: 1026.8,
    ultraviolet_index_clear_sky: 3.4,
    cloud_area_fraction: 39.7,
  };
  assert.equal(
    formatWeather('Oslo', d),
    [
      'Weather in Oslo (Met.no API)',
      'Temperature: 22.3°C',
      'Description: Mostly clear',
      'Humidity: 46.5%',
      'Wind Speed: 2.8 m/s',
      'Pressure: 1026.8 hPa',
      'UV Index: 3.4',
    ].join('\n'),
  );
});
