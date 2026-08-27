import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWeather } from './src/weather.js';

function fakeWeather(details) {
  const now = Date.now();
  const t = (min) => new Date(now + min * 60000).toISOString();
  return {
    get: async () => ({
      data: {
        properties: {
          timeseries: [
            { time: t(-120), data: { instant: { details: { cloud_area_fraction: 0 } } } },
            { time: t(-30), data: { instant: { details } } }, // closest to now
            { time: t(90), data: { instant: { details: { cloud_area_fraction: 100 } } } },
          ],
        },
      },
    }),
  };
}

test('picks the entry closest to now', async () => {
  const w = await fetchWeather(59.91, 10.75, fakeWeather({
    cloud_area_fraction: 60, air_temperature: 17, relative_humidity: 63,
    wind_speed: 2, air_pressure_at_sea_level: 1025, ultraviolet_index_clear_sky: 1,
  }));
  assert.equal(w.temperature, 17);
  assert.equal(w.humidity, 63);
  assert.equal(w.windSpeed, 2);
  assert.equal(w.pressure, 1025);
  assert.equal(w.uvIndex, 1);
  assert.equal(w.description, 'Partly cloudy');
});

test('cloud thresholds', async () => {
  for (const [cloud, desc] of [[80, 'Overcast'], [60, 'Partly cloudy'], [30, 'Mostly clear'], [10, 'Clear']]) {
    const w = await fetchWeather(59.91, 10.75, fakeWeather({ cloud_area_fraction: cloud }));
    assert.equal(w.description, desc);
  }
});

test('empty timeseries -> throws', async () => {
  const http = { get: async () => ({ data: { properties: { timeseries: [] } } }) };
  await assert.rejects(() => fetchWeather(59.91, 10.75, http), /no timeseries/);
});

test('403 -> actionable message', async () => {
  const err = Object.assign(new Error('403'), { response: { status: 403 } });
  const http = { get: async () => { throw err; } };
  await assert.rejects(() => fetchWeather(59.91, 10.75, http), /403/);
});

test('429 -> actionable message', async () => {
  const err = Object.assign(new Error('429'), { response: { status: 429 } });
  const http = { get: async () => { throw err; } };
  await assert.rejects(() => fetchWeather(59.91, 10.75, http), /429/);
});
