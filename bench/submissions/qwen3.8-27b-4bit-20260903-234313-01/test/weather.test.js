import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeClouds, closestEntry, extractWeather, fetchWeather, MET_URL } from '../src/weather.js';

function entry(time, details) {
  return { time, data: { instant: { details } } };
}

test('describeClouds thresholds', () => {
  assert.equal(describeClouds(99.6), 'Overcast');
  assert.equal(describeClouds(75.1), 'Overcast');
  assert.equal(describeClouds(75), 'Partly cloudy');
  assert.equal(describeClouds(50.1), 'Partly cloudy');
  assert.equal(describeClouds(50), 'Mostly clear');
  assert.equal(describeClouds(25.1), 'Mostly clear');
  assert.equal(describeClouds(25), 'Clear');
  assert.equal(describeClouds(0), 'Clear');
  assert.equal(describeClouds(null), 'Unknown');
});

test('closestEntry picks nearest to now', () => {
  const now = new Date('2026-09-03T21:14:00Z');
  const ts = [
    entry('2026-09-03T20:00:00Z', {}),
    entry('2026-09-03T21:00:00Z', { air_temperature: 15.4 }),
    entry('2026-09-03T22:00:00Z', {}),
  ];
  const e = closestEntry(ts, now);
  assert.equal(e.time, '2026-09-03T21:00:00Z');
});

test('closestEntry throws on empty', () => {
  assert.throws(() => closestEntry([]), /no timeseries/);
  assert.throws(() => closestEntry(null), /no timeseries/);
});

test('extractWeather maps all spec fields', () => {
  const e = entry('2026-09-03T21:00:00Z', {
    air_temperature: 15.4,
    relative_humidity: 64.8,
    wind_speed: 2.5,
    air_pressure_at_sea_level: 1003.6,
    cloud_area_fraction: 99.6,
    ultraviolet_index_clear_sky: 0,
  });
  const w = extractWeather(e);
  assert.equal(w.temperature, 15.4);
  assert.equal(w.description, 'Overcast');
  assert.equal(w.humidity, 64.8);
  assert.equal(w.windSpeed, 2.5);
  assert.equal(w.pressure, 1003.6);
  assert.equal(w.uvIndex, 0);
});

test('extractWeather throws when details missing', () => {
  assert.throws(() => extractWeather({ time: 'x', data: {} }), /missing instant.details/);
});

test('fetchWeather sends lat/lon and User-Agent, returns mapped fields', async () => {
  let seen;
  const ax = {
    get: async (url, cfg) => {
      seen = { url, cfg };
      return {
        status: 200,
        data: {
          properties: {
            timeseries: [
              entry('2026-09-03T21:00:00Z', {
                air_temperature: 15.4, relative_humidity: 64.8, wind_speed: 2.5,
                air_pressure_at_sea_level: 1003.6, cloud_area_fraction: 10,
                ultraviolet_index_clear_sky: 3,
              }),
            ],
          },
        },
      };
    },
  };
  const w = await fetchWeather(59.91, 10.75, { axiosInstance: ax });
  assert.equal(seen.url, MET_URL);
  assert.deepEqual(seen.cfg.params, { lat: 59.91, lon: 10.75 });
  assert.match(seen.cfg.headers['User-Agent'], /weather-cli/);
  assert.equal(w.temperature, 15.4);
  assert.equal(w.description, 'Clear');
  assert.equal(w.uvIndex, 3);
});

test('fetchWeather propagates HTTP errors', async () => {
  const ax = { get: async () => { const e = new Error('Request failed with status code 403'); e.response = { status: 403 }; throw e; } };
  await assert.rejects(fetchWeather(59.91, 10.75, { axiosInstance: ax }), /403/);
});
