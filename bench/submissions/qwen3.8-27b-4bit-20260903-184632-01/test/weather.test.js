'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { fetchWeather, pickCurrentEntry, MET_NO_URL, USER_AGENT } = require('../src/weather');

function entry(time, details) {
  return { time, data: { instant: { details } } };
}

function makeHttp(body, { status = 200, error } = {}) {
  return {
    get: async (url, config) => {
      if (error) {
        throw Object.assign(new Error(error.message), { response: { status: error.status, data: error.body } });
      }
      return { status, data: body, config };
    },
  };
}

function bodyWith(timeseries) {
  return { properties: { timeseries } };
}

test('user agent identifies the app with a real contact', () => {
  assert.match(USER_AGENT, /^weather-cli\/1\.0\s+\S+$/);
  assert.doesNotMatch(USER_AGENT, /example\.com/i);
});

test('selects the latest entry at or before the current UTC time', () => {
  const timeseries = [
    entry('2026-09-03T16:00:00Z', {}),
    entry('2026-09-03T17:00:00Z', {}),
    entry('2026-09-03T18:00:00Z', {}),
  ];
  // 16:32 UTC: the 17:00 and 18:00 entries are in the future.
  const picked = pickCurrentEntry(timeseries, new Date('2026-09-03T16:32:00Z'));
  assert.strictEqual(picked.time, '2026-09-03T16:00:00Z');
});

test('selects the exact hour when the current time is on the hour', () => {
  const timeseries = [
    entry('2026-09-03T16:00:00Z', {}),
    entry('2026-09-03T17:00:00Z', {}),
  ];
  const picked = pickCurrentEntry(timeseries, new Date('2026-09-03T17:00:00Z'));
  assert.strictEqual(picked.time, '2026-09-03T17:00:00Z');
});

test('throws when no entry is at or before now', () => {
  const timeseries = [entry('2026-09-03T18:00:00Z', {})];
  assert.throws(() => pickCurrentEntry(timeseries, new Date('2026-09-03T16:32:00Z')), /does not cover/);
});

test('requests the met.no endpoint with encoded lat lon and user agent', async () => {
  let seenUrl = null;
  let seenConfig = null;
  const http = {
    get: async (url, config) => {
      seenUrl = url;
      seenConfig = config;
      return { status: 200, data: bodyWith([entry('2026-09-03T16:00:00Z', { air_temperature: 1 })]) };
    },
  };
  await fetchWeather(59.91, 10.75, { http, userAgent: 'test-agent/1.0 contact@test', now: new Date('2026-09-03T16:32:00Z') });
  assert.ok(seenUrl.startsWith(`${MET_NO_URL}?`));
  const query = new URL(seenUrl).searchParams;
  assert.strictEqual(query.get('lat'), '59.91');
  assert.strictEqual(query.get('lon'), '10.75');
  assert.strictEqual(seenConfig.headers['User-Agent'], 'test-agent/1.0 contact@test');
});

test('returns the instant details of the selected entry', async () => {
  const details = {
    air_temperature: 19.8,
    relative_humidity: 41,
    wind_speed: 3.4,
    air_pressure_at_sea_level: 1003.5,
    cloud_area_fraction: 71.2,
    ultraviolet_index_clear_sky: 0.5,
  };
  const http = makeHttp(bodyWith([entry('2026-09-03T16:00:00Z', details)]));
  const result = await fetchWeather(59.91, 10.75, { http, now: new Date('2026-09-03T16:32:00Z') });
  assert.deepStrictEqual(result.details, details);
  assert.strictEqual(result.time, '2026-09-03T16:00:00Z');
});

test('http 403 is reported as a policy block, not throttling', async () => {
  const http = makeHttp(null, { error: { status: 403, message: 'forbidden' } });
  await assert.rejects(
    fetchWeather(59.91, 10.75, { http, now: new Date('2026-09-03T16:32:00Z') }),
    (error) => {
      assert.strictEqual(error.exitCode, 1);
      assert.match(error.message, /403/);
      assert.match(error.message, /not rate limiting/);
      return true;
    }
  );
});

test('other http failures are reported with exit code 1', async () => {
  const http = makeHttp(null, { error: { status: 502, message: 'bad gateway' } });
  await assert.rejects(
    fetchWeather(59.91, 10.75, { http, now: new Date('2026-09-03T16:32:00Z') }),
    (error) => {
      assert.strictEqual(error.exitCode, 1);
      assert.match(error.message, /502/);
      return true;
    }
  );
});

test('a response without a timeseries throws with exit code 1', async () => {
  const http = makeHttp({ properties: {} });
  await assert.rejects(
    fetchWeather(59.91, 10.75, { http, now: new Date('2026-09-03T16:32:00Z') }),
    (error) => {
      assert.match(error.message, /timeseries/);
      assert.strictEqual(error.exitCode, 1);
      return true;
    }
  );
});
