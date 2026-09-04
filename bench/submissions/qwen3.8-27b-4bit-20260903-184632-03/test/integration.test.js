'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { run } = require('../src/main');
const { parseLocation } = require('../src/parser');
const { geocode } = require('../src/geocode');
const { fetchWeather } = require('../src/weather');

const NOW = new Date('2026-09-03T16:30:00Z');

function mockAxios(responses) {
  const calls = [];
  const instance = {
    get: async (url, config) => {
      calls.push({ url, config });
      const responder = responses.find((r) => url.startsWith(r.prefix));
      if (!responder) {
        throw new Error(`Unexpected URL: ${url}`);
      }
      if (responder.error) {
        const err = new Error(responder.error.message);
        err.response = { status: responder.error.status };
        throw err;
      }
      return responder.response;
    },
  };
  return { instance, calls };
}

function metnoResponse(details) {
  return {
    data: {
      type: 'Feature',
      properties: {
        meta: { updated_at: '2026-09-03T16:32:27Z' },
        timeseries: [{ time: '2026-09-03T15:00:00Z', data: { instant: { details } } }],
      },
    },
  };
}

const geonorgeOslo = {
  data: {
    navn: [
      {
        geojson: { geometry: { type: 'Point', coordinates: [10.73353, 59.91187] } },
        stedsnavn: [{ navnestatus: 'hovednavn', skrivemaate: 'Oslo fylke', språk: 'Norsk' }],
      },
    ],
  },
};

test('full flow: place name → geocode → weather → formatted output', async () => {
  const { instance, calls } = mockAxios([
    { prefix: 'https://ws.geonorge.no', response: geonorgeOslo },
    {
      prefix: 'https://api.met.no',
      response: metnoResponse({
        air_temperature: 19.8,
        relative_humidity: 41,
        wind_speed: 3.4,
        air_pressure_at_sea_level: 1003.5,
        cloud_area_fraction: 71.2,
        ultraviolet_index_clear_sky: 0.5,
      }),
    },
  ]);

  const out = await run(['node', 'weather', 'Oslo'], { axiosInstance: instance, now: NOW });

  assert.strictEqual(
    out,
    [
      'Weather in Oslo fylke (Met.no API)',
      'Temperature: 19.8°C',
      'Description: Partly cloudy',
      'Humidity: 41%',
      'Wind Speed: 3.4 m/s',
      'Pressure: 1003.5 hPa',
      'UV Index: 0.5',
    ].join('\n')
  );
  assert.strictEqual(calls.length, 2);
  assert.ok(calls[0].url.startsWith('https://ws.geonorge.no/stedsnavn/v1/sted?sok=Oslo'));
  assert.ok(calls[1].url.includes('lat=59.91187'));
  assert.ok(calls[1].url.includes('lon=10.73353'));
});

test('full flow: coordinates skip geocoding entirely', async () => {
  const { instance, calls } = mockAxios([
    {
      prefix: 'https://api.met.no',
      response: metnoResponse({
        air_temperature: 18,
        relative_humidity: 55,
        wind_speed: 2,
        air_pressure_at_sea_level: 1010,
        cloud_area_fraction: 10,
        ultraviolet_index_clear_sky: 3,
      }),
    },
  ]);

  const out = await run(['node', 'weather', '59.91 10.75'], { axiosInstance: instance, now: NOW });

  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].url.startsWith('https://api.met.no'));
  assert.ok(out.startsWith('Weather in 59.91, 10.75 (Met.no API)'));
  assert.ok(out.includes('Description: Clear'));
});

test('geocoding failure propagates and no weather call is made', async () => {
  const { instance, calls } = mockAxios([
    { prefix: 'https://ws.geonorge.no', error: { status: 404, message: 'not found' } },
    { prefix: 'https://api.met.no', response: metnoResponse({}) },
  ]);

  await assert.rejects(run(['node', 'weather', 'Nowhere'], { axiosInstance: instance, now: NOW }), /no place found/i);
  assert.strictEqual(calls.length, 1);
});

test('Met.no 403 propagates as a hard error', async () => {
  const { instance } = mockAxios([
    { prefix: 'https://api.met.no', error: { status: 403, message: 'forbidden' } },
  ]);

  await assert.rejects(
    run(['node', 'weather', '59.91 10.75'], { axiosInstance: instance, now: NOW }),
    /HTTP 403/
  );
});

test('invalid coordinates fail before any network call', async () => {
  const { instance, calls } = mockAxios([
    { prefix: 'https://api.met.no', response: metnoResponse({}) },
  ]);
  await assert.rejects(run(['node', 'weather', '999 999'], { axiosInstance: instance, now: NOW }), /latitude/i);
  assert.strictEqual(calls.length, 0);
});

test('modules are independently composable', async () => {
  const parsed = parseLocation('Bergen');
  assert.strictEqual(parsed.name, 'Bergen');

  const { instance } = mockAxios([
    { prefix: 'https://ws.geonorge.no', response: geonorgeOslo },
  ]);
  const place = await geocode('Bergen', { axiosInstance: instance });
  assert.strictEqual(place.lat, 59.91187);

  const metno = mockAxios([
    {
      prefix: 'https://api.met.no',
      response: metnoResponse({
        air_temperature: 5,
        relative_humidity: 90,
        wind_speed: 8,
        air_pressure_at_sea_level: 980,
        cloud_area_fraction: 99,
        ultraviolet_index_clear_sky: 0.1,
      }),
    },
  ]);
  const wx = await fetchWeather({ lat: place.lat, lon: place.lon, userAgent: 'ua' }, { axiosInstance: metno.instance, now: NOW });
  assert.strictEqual(wx.description, 'Overcast');
});
