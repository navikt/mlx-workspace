import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWeather, pickEntry, USER_AGENT } from '../src/weather.js';

function entry(time, details) {
  return { time, data: { instant: { details } } };
}

const fullDetails = {
  air_temperature: 12.6,
  relative_humidity: 64.7,
  cloud_area_fraction: 12.7,
  wind_speed: 0.7,
  air_pressure_at_sea_level: 1007.1,
  ultraviolet_index_clear_sky: 0.3,
};

function fakeHttp(timeseries) {
  return async (url, config) => ({ data: { properties: { timeseries } }, url, config });
}

test('picks the entry closest to now, computed in UTC', () => {
  const ts = [
    entry('2026-09-03T05:00:00Z', { ...fullDetails, air_temperature: 1 }),
    entry('2026-09-03T06:00:00Z', { ...fullDetails, air_temperature: 2 }),
  ];
  const now = new Date('2026-09-03T05:30:00Z');
  assert.equal(pickEntry(ts, now).data.instant.details.air_temperature, 1);
  const justBefore = new Date('2026-09-03T05:59:59Z');
  assert.equal(pickEntry(ts, justBefore).data.instant.details.air_temperature, 1);
  const justAfter = new Date('2026-09-03T06:00:01Z');
  assert.equal(pickEntry(ts, justAfter).data.instant.details.air_temperature, 2);
});

test('does not depend on host local timezone', () => {
  const ts = [entry('2026-09-03T05:00:00Z', { ...fullDetails, air_temperature: 1 }),
               entry('2026-09-03T06:00:00Z', { ...fullDetails, air_temperature: 2 })];
  const now = new Date('2026-09-03T05:30:00Z');
  const original = process.env.TZ;
  try {
    for (const tz of ['Pacific/Kiritimati', 'America/Anchorage', 'UTC']) {
      process.env.TZ = tz;
      assert.equal(pickEntry(ts, now).data.instant.details.air_temperature, 1);
    }
  } finally {
    process.env.TZ = original;
  }
});

test('fetchWeather returns instant details and flags UV presence', async () => {
  const ts = [entry('2026-09-03T06:00:00Z', fullDetails)];
  const wx = await fetchWeather(59.91, 10.75, { http: fakeHttp(ts) });
  assert.equal(wx.details.air_temperature, 12.6);
  assert.equal(wx.hasUv, true);
  assert.equal(wx.uv, 0.3);
});

test('entry without UV index is usable, not undefined', async () => {
  const noUv = { ...fullDetails };
  delete noUv.ultraviolet_index_clear_sky;
  const wx = await fetchWeather(59.91, 10.75, { http: fakeHttp([entry('2026-09-03T06:00:00Z', noUv)]) });
  assert.equal(wx.hasUv, false);
  assert.equal(wx.uv, undefined);
});

test('entry without cloud cover is a hard error', async () => {
  const noClouds = { ...fullDetails };
  delete noClouds.cloud_area_fraction;
  await assert.rejects(
    fetchWeather(59.91, 10.75, { http: fakeHttp([entry('2026-09-03T06:00:00Z', noClouds)]) }),
    /missing cloud cover/,
  );
});

test('empty timeseries is a hard error', async () => {
  await assert.rejects(fetchWeather(59.91, 10.75, { http: fakeHttp([]) }), /no timeseries/);
});

test('sends User-Agent in request', async () => {
  let config;
  const http = async (url, c) => { config = c; return { data: { properties: { timeseries: [entry('2026-09-03T06:00:00Z', fullDetails)] } } }; };
  await fetchWeather(59.91, 10.75, { http, userAgent: 'test-agent/9.9' });
  assert.equal(config.headers['User-Agent'], 'test-agent/9.9');
});

test('default User-Agent has no placeholder contact', () => {
  assert.doesNotMatch(USER_AGENT, /example\.com/);
});

test('encodes coordinates in the URL', async () => {
  let seen;
  const http = async (url) => { seen = url; return { data: { properties: { timeseries: [entry('2026-09-03T06:00:00Z', fullDetails)] } } }; };
  await fetchWeather('59.91', '10.75', { http });
  assert.match(seen, /lat=59\.91&lon=10\.75/);
});
