'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { formatWeather, describeCloudCover } = require('../src/output');

function details(overrides = {}) {
  return {
    air_temperature: 19.8,
    relative_humidity: 41,
    wind_speed: 3.4,
    air_pressure_at_sea_level: 1003.5,
    cloud_area_fraction: 71.2,
    ultraviolet_index_clear_sky: 0.5,
    ...overrides,
  };
}

test('cloud cover above 75 is overcast', () => {
  assert.strictEqual(describeCloudCover(75.1), 'Overcast');
  assert.strictEqual(describeCloudCover(100), 'Overcast');
});

test('cloud cover of exactly 75 is partly cloudy, not overcast', () => {
  assert.strictEqual(describeCloudCover(75), 'Partly cloudy');
});

test('cloud cover above 50 is partly cloudy', () => {
  assert.strictEqual(describeCloudCover(50.1), 'Partly cloudy');
});

test('cloud cover of exactly 50 is mostly clear, not partly cloudy', () => {
  assert.strictEqual(describeCloudCover(50), 'Mostly clear');
});

test('cloud cover above 25 is mostly clear', () => {
  assert.strictEqual(describeCloudCover(25.1), 'Mostly clear');
});

test('cloud cover of exactly 25 and below is clear', () => {
  assert.strictEqual(describeCloudCover(25), 'Clear');
  assert.strictEqual(describeCloudCover(0), 'Clear');
});

test('formats the full output block', () => {
  const output = formatWeather('Oslo', details());
  const lines = output.split('\n');
  assert.deepStrictEqual(lines, [
    'Weather in Oslo (Met.no API)',
    'Temperature: 19.8\u00b0C',
    'Description: Partly cloudy',
    'Humidity: 41%',
    'Wind Speed: 3.4 m/s',
    'Pressure: 1003.5 hPa',
    'UV Index: 0.5',
  ]);
});

test('missing uv index throws with exit code 1 instead of printing undefined', () => {
  const d = details();
  delete d.ultraviolet_index_clear_sky;
  assert.throws(() => formatWeather('Oslo', d), (error) => {
    assert.match(error.message, /UV index/);
    assert.strictEqual(error.exitCode, 1);
    return true;
  });
});

test('missing cloud fraction throws with exit code 1 instead of printing Clear', () => {
  const d = details();
  delete d.cloud_area_fraction;
  assert.throws(() => formatWeather('Oslo', d), (error) => {
    assert.match(error.message, /cloud cover/);
    assert.strictEqual(error.exitCode, 1);
    return true;
  });
});
