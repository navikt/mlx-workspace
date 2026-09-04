'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { geocode } = require('../src/geocode');

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

const osloResponse = {
  data: {
    metadata: { totaltAntallTreff: 125 },
    navn: [
      {
        fylker: [{ fylkesnavn: 'Oslo' }],
        geojson: { geometry: { type: 'Point', coordinates: [10.73353, 59.91187] } },
        stedsnavn: [
          { navnestatus: 'hovednavn', skrivemaate: 'Oslo fylke', språk: 'Norsk' },
          { navnestatus: 'hovednavn', skrivemaate: 'Oslo', språk: 'Norsk' },
        ],
      },
    ],
  },
};

test('geocodes a place name and swaps GeoJSON [lon, lat] to lat/lon', async () => {
  const result = await geocode('Oslo', { axiosInstance: mockAxios(osloResponse) });
  assert.strictEqual(result.lat, 59.91187);
  assert.strictEqual(result.lon, 10.73353);
  assert.strictEqual(result.name, 'Oslo fylke');
});

test('URL-encodes the place name before building the URL', async () => {
  await geocode('Båtsfjord & co', { axiosInstance: mockAxios(osloResponse) });
  assert.ok(mockAxios.lastUrl.includes('sok=B%C3%A5tsfjord%20%26%20co'));
  assert.ok(!mockAxios.lastUrl.includes(' & '));
});

test('sends Accept and User-Agent headers', async () => {
  await geocode('Oslo', { userAgent: 'weather-cli/1.0 me@example.org', axiosInstance: mockAxios(osloResponse) });
  assert.strictEqual(mockAxios.lastConfig.headers.Accept, 'application/json');
  assert.strictEqual(mockAxios.lastConfig.headers['User-Agent'], 'weather-cli/1.0 me@example.org');
});

test('throws when no hits are returned', async () => {
  await assert.rejects(
    geocode('Nowhere', { axiosInstance: mockAxios({ data: { navn: [] } }) }),
    /no place found/i
  );
});

test('throws when the hit has no coordinates', async () => {
  const resp = { data: { navn: [{ stedsnavn: [{ navnestatus: 'hovednavn', skrivemaate: 'X' }] }] } };
  await assert.rejects(geocode('X', { axiosInstance: mockAxios(resp) }), /no coordinates/i);
});

test('throws on HTTP 404 from Geonorge', async () => {
  await assert.rejects(
    geocode('Oslo', { axiosInstance: mockAxios(httpError(404)) }),
    /no place found/i
  );
});

test('throws on other HTTP errors', async () => {
  await assert.rejects(
    geocode('Oslo', { axiosInstance: mockAxios(httpError(500)) }),
    /HTTP 500/
  );
});

test('throws on network failure', async () => {
  const err = new Error('getaddrinfo ENOTFOUND ws.geonorge.no');
  await assert.rejects(geocode('Oslo', { axiosInstance: mockAxios(err) }), /Geocoding failed/);
});
