'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const {
  fetchWeather,
  closestEntry,
  deriveDescription,
  extractWeather,
  METNO_URL,
} = require('./weather');

function makeEntry(time, details) {
  return { time, data: { instant: { details } } };
}

const baseDetails = {
  air_temperature: 14,
  relative_humidity: 69.7,
  wind_speed: 2.5,
  air_pressure_at_sea_level: 1003,
  cloud_area_fraction: 100,
  ultraviolet_index_clear_sky: 0,
};

function makeForecast(entries) {
  return { type: 'Feature', geometry: {}, properties: { meta: {}, timeseries: entries } };
}

test('deriveDescription thresholds', () => {
  assert.strictEqual(deriveDescription(100), 'Overcast');
  assert.strictEqual(deriveDescription(76), 'Overcast');
  assert.strictEqual(deriveDescription(75), 'Partly cloudy');
  assert.strictEqual(deriveDescription(51), 'Partly cloudy');
  assert.strictEqual(deriveDescription(50), 'Mostly clear');
  assert.strictEqual(deriveDescription(26), 'Mostly clear');
  assert.strictEqual(deriveDescription(25), 'Clear');
  assert.strictEqual(deriveDescription(0), 'Clear');
});

test('closestEntry picks entry nearest to now', () => {
  const now = new Date('2026-09-03T22:30:00Z');
  const entries = [
    makeEntry('2026-09-03T21:00:00Z', baseDetails),
    makeEntry('2026-09-03T22:00:00Z', baseDetails),
    makeEntry('2026-09-03T23:00:00Z', baseDetails),
  ];
  const best = closestEntry(entries, now);
  assert.strictEqual(best.time, '2026-09-03T22:00:00Z');
});

test('closestEntry throws on empty timeseries', () => {
  assert.throws(() => closestEntry([], new Date()), /No timeseries/);
});

test('extractWeather maps instant.details to output fields', () => {
  const now = new Date('2026-09-03T22:30:00Z');
  const data = makeForecast([
    makeEntry('2026-09-03T22:00:00Z', { ...baseDetails, cloud_area_fraction: 60 }),
  ]);
  const w = extractWeather(data, now);
  assert.strictEqual(w.temperature, 14);
  assert.strictEqual(w.description, 'Partly cloudy');
  assert.strictEqual(w.humidity, 69.7);
  assert.strictEqual(w.windSpeed, 2.5);
  assert.strictEqual(w.pressure, 1003);
  assert.strictEqual(w.uvIndex, 0);
});

test('fetchWeather calls Met.no with lat/lon and User-Agent', async () => {
  let captured;
  const http = {
    get: async (url, config) => {
      captured = { url, config };
      return { data: makeForecast([makeEntry('2026-09-03T22:00:00Z', baseDetails)]) };
    },
  };
  const data = await fetchWeather(59.91, 10.75, { http });
  assert.strictEqual(captured.url, METNO_URL);
  assert.deepStrictEqual(captured.config.params, { lat: 59.91, lon: 10.75 });
  assert.match(captured.config.headers['User-Agent'], /^weather-cli\/1\.0 /);
  assert.ok(data.properties.timeseries.length === 1);
});
