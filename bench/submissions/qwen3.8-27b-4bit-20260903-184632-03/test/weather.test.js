'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { fetchWeather, closestEntry, deriveDescription } = require('../src/weather');

function entry(time, details) {
  return { time, data: { instant: { details } } };
}

function fullDetails(overrides = {}) {
  return {
    air_temperature: 19.8,
    relative_humidity: 41.0,
    wind_speed: 3.4,
    air_pressure_at_sea_level: 1003.5,
    cloud_area_fraction: 71.2,
    ultraviolet_index_clear_sky: 0.5,
    ...overrides,
  };
}

function metnoResponse(entries) {
  return { data: { type: 'Feature', properties: { meta: { updated_at: '2026-09-03T16:32:27Z' }, timeseries: entries } } };
}

function mockAxios(response) {
  return {
    get: async (url, config) => {
      mockAxios.lastUrl = url;
      mockAxios.lastConfig = config;
      if (response instanceof Error) {
        throw response;
      }
      return response;
    },
  };
}

function httpError(status) {
  const err = new Error(`Request failed with status code ${status}`);
  err.response = { status };
  return err;
}

const NOW = new Date('2026-09-03T16:30:00Z');

test('selects the closest timeseries entry in UTC', async () => {
  const entries = [
    entry('2026-09-03T12:00:00Z', fullDetails()),
    entry('2026-09-03T15:00:00Z', fullDetails({ air_temperature: 15.5 })),
    entry('2026-09-03T18:00:00Z', fullDetails({ air_temperature: 12.0 })),
  ];
  const result = await fetchWeather(
    { lat: 59.91, lon: 10.75, userAgent: 'weather-cli/1.0 me@example.org' },
    { axiosInstance: mockAxios(metnoResponse(entries)), now: NOW }
  );
  assert.strictEqual(result.temperature, 15.5);
  assert.strictEqual(result.time, '2026-09-03T15:00:00Z');
});

test('closestEntry is independent of host timezone (UTC math)', () => {
  const entries = [
    entry('2026-09-03T12:00:00Z', fullDetails()),
    entry('2026-09-03T18:00:00Z', fullDetails()),
  ];
  const best = closestEntry(entries, new Date('2026-09-03T16:30:00Z'));
  assert.strictEqual(best.time, '2026-09-03T18:00:00Z');
});

test('sends User-Agent header and encoded lat/lon in the URL', async () => {
  await fetchWeather(
    { lat: 59.91, lon: 10.75, userAgent: 'weather-cli/1.0 me@example.org' },
    { axiosInstance: mockAxios(metnoResponse([entry('2026-09-03T15:00:00Z', fullDetails())])), now: NOW }
  );
  assert.strictEqual(mockAxios.lastConfig.headers['User-Agent'], 'weather-cli/1.0 me@example.org');
  assert.ok(mockAxios.lastUrl.includes('lat=59.91'));
  assert.ok(mockAxios.lastUrl.includes('lon=10.75'));
});

test('derives description from cloud_area_fraction with documented boundaries', () => {
  assert.strictEqual(deriveDescription(75), 'Partly cloudy'); // exactly 75 is NOT overcast
  assert.strictEqual(deriveDescription(75.1), 'Overcast');
  assert.strictEqual(deriveDescription(50), 'Mostly clear'); // exactly 50 is NOT partly cloudy
  assert.strictEqual(deriveDescription(50.1), 'Partly cloudy');
  assert.strictEqual(deriveDescription(25), 'Clear'); // exactly 25 is NOT mostly clear
  assert.strictEqual(deriveDescription(25.1), 'Mostly clear');
  assert.strictEqual(deriveDescription(0), 'Clear');
  assert.strictEqual(deriveDescription(100), 'Overcast');
});

test('missing ultraviolet_index_clear_sky throws instead of printing undefined', async () => {
  const details = fullDetails();
  delete details.ultraviolet_index_clear_sky;
  await assert.rejects(
    fetchWeather(
      { lat: 59.91, lon: 10.75, userAgent: 'ua' },
      { axiosInstance: mockAxios(metnoResponse([entry('2026-09-03T15:00:00Z', details)])), now: NOW }
    ),
    /missing ultraviolet_index_clear_sky/
  );
});

test('missing cloud_area_fraction throws instead of guessing "Clear"', async () => {
  const details = fullDetails();
  delete details.cloud_area_fraction;
  await assert.rejects(
    fetchWeather(
      { lat: 59.91, lon: 10.75, userAgent: 'ua' },
      { axiosInstance: mockAxios(metnoResponse([entry('2026-09-03T15:00:00Z', details)])), now: NOW }
    ),
    /missing cloud_area_fraction/
  );
});

test('missing air_temperature throws', async () => {
  const details = fullDetails();
  delete details.air_temperature;
  await assert.rejects(
    fetchWeather(
      { lat: 59.91, lon: 10.75, userAgent: 'ua' },
      { axiosInstance: mockAxios(metnoResponse([entry('2026-09-03T15:00:00Z', details)])), now: NOW }
    ),
    /missing air_temperature/
  );
});

test('malformed response without timeseries throws', async () => {
  await assert.rejects(
    fetchWeather(
      { lat: 59.91, lon: 10.75, userAgent: 'ua' },
      { axiosInstance: mockAxios({ data: { properties: {} } }), now: NOW }
    ),
    /missing properties.timeseries/
  );
});

test('HTTP 403 is a hard failure: no retries, no backoff', async () => {
  let calls = 0;
  const axiosInstance = {
    get: async () => {
      calls++;
      throw httpError(403);
    },
  };
  await assert.rejects(
    fetchWeather({ lat: 1, lon: 1, userAgent: 'ua' }, { axiosInstance, now: NOW, backoffMs: 1, retries: 2 }),
    /HTTP 403/
  );
  assert.strictEqual(calls, 1);
});

test('HTTP 429 is retried with backoff then succeeds', async () => {
  let calls = 0;
  const axiosInstance = {
    get: async () => {
      calls++;
      if (calls < 3) {
        throw httpError(429);
      }
      return metnoResponse([entry('2026-09-03T15:00:00Z', fullDetails())]);
    },
  };
  const result = await fetchWeather(
    { lat: 1, lon: 1, userAgent: 'ua' },
    { axiosInstance, now: NOW, backoffMs: 1, retries: 3 }
  );
  assert.strictEqual(calls, 3);
  assert.strictEqual(result.temperature, 19.8);
});

test('HTTP 429 keeps failing until retries are exhausted', async () => {
  let calls = 0;
  const axiosInstance = {
    get: async () => {
      calls++;
      throw httpError(429);
    },
  };
  await assert.rejects(
    fetchWeather({ lat: 1, lon: 1, userAgent: 'ua' }, { axiosInstance, now: NOW, backoffMs: 1, retries: 3 }),
    /HTTP 429/
  );
  assert.strictEqual(calls, 4); // 1 initial + 3 retries
});

test('other HTTP errors (500) are not retried', async () => {
  let calls = 0;
  const axiosInstance = {
    get: async () => {
      calls++;
      throw httpError(500);
    },
  };
  await assert.rejects(
    fetchWeather({ lat: 1, lon: 1, userAgent: 'ua' }, { axiosInstance, now: NOW, backoffMs: 1, retries: 2 }),
    /HTTP 500/
  );
  assert.strictEqual(calls, 1);
});

test('extracts all output fields from instant.details', async () => {
  const result = await fetchWeather(
    { lat: 59.91, lon: 10.75, userAgent: 'ua' },
    {
      axiosInstance: mockAxios(
        metnoResponse([entry('2026-09-03T15:00:00Z', fullDetails({ cloud_area_fraction: 80 }))])
      ),
      now: NOW,
    }
  );
  assert.strictEqual(result.temperature, 19.8);
  assert.strictEqual(result.description, 'Overcast');
  assert.strictEqual(result.humidity, 41.0);
  assert.strictEqual(result.windSpeed, 3.4);
  assert.strictEqual(result.pressure, 1003.5);
  assert.strictEqual(result.uvIndex, 0.5);
});
