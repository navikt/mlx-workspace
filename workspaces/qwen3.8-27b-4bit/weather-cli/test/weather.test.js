import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCloudCover, closestEntry, extractWeather, fetchWeather, USER_AGENT } from '../lib/weather.js';

test('describeCloudCover thresholds', () => {
  assert.equal(describeCloudCover(100), 'Overcast');
  assert.equal(describeCloudCover(76), 'Overcast');
  assert.equal(describeCloudCover(75), 'Partly cloudy');
  assert.equal(describeCloudCover(51), 'Partly cloudy');
  assert.equal(describeCloudCover(50), 'Mostly clear');
  assert.equal(describeCloudCover(26), 'Mostly clear');
  assert.equal(describeCloudCover(25), 'Clear');
  assert.equal(describeCloudCover(0), 'Clear');
});

test('closestEntry picks entry nearest to now', () => {
  const timeseries = [
    { time: '2026-08-28T10:00:00Z', data: { instant: { details: { x: 1 } } } },
    { time: '2026-08-28T11:00:00Z', data: { instant: { details: { x: 2 } } } },
  ];
  const now = new Date('2026-08-28T10:40:00Z');
  assert.equal(closestEntry(timeseries, now).data.instant.details.x, 2);
  const early = new Date('2026-08-28T10:10:00Z');
  assert.equal(closestEntry(timeseries, early).data.instant.details.x, 1);
});

const met = {
  type: 'Feature',
  properties: {
    timeseries: [
      {
        time: '2026-08-28T10:00:00Z',
        data: {
          instant: {
            details: {
              air_temperature: 17.2,
              cloud_area_fraction: 100.0,
              relative_humidity: 74.3,
              wind_speed: 4.9,
              air_pressure_at_sea_level: 1016.3,
              ultraviolet_index_clear_sky: 3.1,
            },
          },
        },
      },
    ],
  },
};

test('extractWeather maps instant.details fields', () => {
  const w = extractWeather(met, new Date('2026-08-28T10:30:00Z'));
  assert.deepEqual(w, {
    temperature: 17.2,
    description: 'Overcast',
    humidity: 74.3,
    windSpeed: 4.9,
    pressure: 1016.3,
    uvIndex: 3.1,
  });
});

test('extractWeather throws without timeseries', () => {
  assert.throws(() => extractWeather({ properties: {} }), /No timeseries data/);
});

test('fetchWeather sends User-Agent and returns mapped weather', async () => {
  const captured = {};
  const http = {
    get: async (url, config) => {
      captured.url = url;
      captured.config = config;
      return { data: met };
    },
  };
  const w = await fetchWeather(59.91, 10.75, { http, now: new Date('2026-08-28T10:30:00Z') });
  assert.equal(captured.url, 'https://api.met.no/weatherapi/locationforecast/2.0/complete');
  assert.deepEqual(captured.config.params, { lat: 59.91, lon: 10.75 });
  assert.equal(captured.config.headers['User-Agent'], USER_AGENT);
  assert.equal(w.temperature, 17.2);
  assert.equal(w.description, 'Overcast');
});

test('fetchWeather propagates http errors', async () => {
  const http = { get: async () => { throw new Error('403 Forbidden'); } };
  await assert.rejects(fetchWeather(59.91, 10.75, { http }), /403/);
});
