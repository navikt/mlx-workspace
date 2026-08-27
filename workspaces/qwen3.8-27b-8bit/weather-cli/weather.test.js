import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWeather, closestEntry } from './fetchWeather.js';
import { USER_AGENT } from './geocode.js';

function entry(time, temp) {
  return {
    time,
    data: {
      instant: {
        details: {
          air_temperature: temp,
          relative_humidity: 46.5,
          wind_speed: 2.8,
          air_pressure_at_sea_level: 1026.8,
          ultraviolet_index_clear_sky: 3.4,
          cloud_area_fraction: 39.7,
        },
      },
    },
  };
}

function fakeHttp(timeseries) {
  const calls = [];
  return {
    calls,
    get: async (url, opts) => {
      calls.push({ url, opts });
      return { data: { properties: { timeseries } } };
    },
  };
}

const now = Date.now();
const t = (offsetMin) => new Date(now + offsetMin * 60000).toISOString();

test('closestEntry picks nearest timestamp', () => {
  const series = [entry(t(-60), 1), entry(t(-31), 2), entry(t(29), 3)];
  assert.equal(closestEntry(series, now).data.instant.details.air_temperature, 3);
});

test('fetchWeather returns instant.details of closest entry', async () => {
  const http = fakeHttp([entry(t(-60), 1), entry(t(29), 3)]);
  const details = await fetchWeather(59.91, 10.75, http);
  assert.equal(details.air_temperature, 3);
  assert.equal(details.relative_humidity, 46.5);
});

test('sends lat/lon params and User-Agent header', async () => {
  const http = fakeHttp([entry(t(0), 1)]);
  await fetchWeather(59.91, 10.75, http);
  const { url, opts } = http.calls[0];
  assert.equal(url, 'https://api.met.no/weatherapi/locationforecast/2.0/complete');
  assert.deepEqual(opts.params, { lat: 59.91, lon: 10.75 });
  assert.equal(opts.headers['User-Agent'], USER_AGENT);
});

test('empty timeseries → throw', async () => {
  const http = fakeHttp([]);
  await assert.rejects(() => fetchWeather(59.91, 10.75, http), /No timeseries data/);
});
