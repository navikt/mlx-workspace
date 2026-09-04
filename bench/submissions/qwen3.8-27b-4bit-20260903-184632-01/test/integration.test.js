'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { run } = require('../index');

function metNoBody(timeseries) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [10.75, 59.91, 3] },
    properties: { meta: { updated_at: '2026-09-03T16:32:27Z' }, timeseries },
  };
}

function metDetails(overrides = {}) {
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

function fakeHttp({ geoBody, metBody, metStatus, metError } = {}) {
  return {
    get: async (url) => {
      if (url.startsWith('https://api.met.no/')) {
        if (metError) {
          throw Object.assign(new Error(metError.message), { response: { status: metStatus, data: metError.body } });
        }
        return { status: metStatus || 200, data: metBody };
      }
      if (url.startsWith('https://ws.geonorge.no/')) {
        return { status: 200, data: geoBody };
      }
      throw new Error(`Unexpected URL in fake http: ${url}`);
    },
  };
}

const geoOslo = {
  metadata: { totaltAntallTreff: 1 },
  navn: [{ navn: 'Oslo', geojson: { geometry: { type: 'Point', coordinates: [10.73353, 59.91187] } } }],
};

test('run() with a place name geocodes then fetches and formats', async () => {
  const http = fakeHttp({
    geoBody: geoOslo,
    metBody: metNoBody([
      { time: '2026-09-03T16:00:00Z', data: { instant: { details: metDetails() } } },
    ]),
  });
  const output = await run(['Oslo'], { http, now: new Date('2026-09-03T16:32:00Z') });
  assert.match(output, /Weather in Oslo \(Met\.no API\)/);
  assert.match(output, /Temperature: 19\.8\u00b0C/);
  assert.match(output, /Description: Partly cloudy/);
  assert.match(output, /Humidity: 41%/);
  assert.match(output, /Wind Speed: 3\.4 m\/s/);
  assert.match(output, /Pressure: 1003\.5 hPa/);
  assert.match(output, /UV Index: 0\.5/);
});

test('run() with coordinates skips geocoding', async () => {
  const http = fakeHttp({
    metBody: metNoBody([
      { time: '2026-09-03T16:00:00Z', data: { instant: { details: metDetails() } } },
    ]),
  });
  const output = await run(['59.91', '10.75'], { http, now: new Date('2026-09-03T16:32:00Z') });
  assert.match(output, /Weather in 59\.91, 10\.75 \(Met\.no API\)/);
});

test('run() with no location rejects with exit code 1', async () => {
  await assert.rejects(run([], { http: fakeHttp({}) }), (error) => {
    assert.match(error.message, /No location given/);
    assert.strictEqual(error.exitCode, 1);
    return true;
  });
});

test('run() propagates geocoding failure with exit code 1', async () => {
  const http = fakeHttp({ geoBody: { metadata: { totaltAntallTreff: 0 }, navn: [] } });
  await assert.rejects(run(['Nowhere'], { http, now: new Date('2026-09-03T16:32:00Z') }), (error) => {
    assert.match(error.message, /No place found/);
    assert.strictEqual(error.exitCode, 1);
    return true;
  });
});

test('run() propagates met.no 403 with exit code 1 and no retry', async () => {
  let calls = 0;
  const http = {
    get: async () => {
      calls += 1;
      throw Object.assign(new Error('forbidden'), { response: { status: 403, data: {} } });
    },
  };
  await assert.rejects(
    run(['59.91', '10.75'], { http, now: new Date('2026-09-03T16:32:00Z') }),
    (error) => {
      assert.match(error.message, /403/);
      assert.strictEqual(error.exitCode, 1);
      return true;
    }
  );
  assert.strictEqual(calls, 1);
});

test('run() fails with exit code 1 when the uv index is absent', async () => {
  const d = metDetails();
  delete d.ultraviolet_index_clear_sky;
  const http = fakeHttp({
    metBody: metNoBody([{ time: '2026-09-03T16:00:00Z', data: { instant: { details: d } } }]),
  });
  await assert.rejects(
    run(['59.91', '10.75'], { http, now: new Date('2026-09-03T16:32:00Z') }),
    (error) => {
      assert.match(error.message, /UV index/);
      assert.strictEqual(error.exitCode, 1);
      return true;
    }
  );
});
