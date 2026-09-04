import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocode, GEO_URL } from '../src/geocode.js';

function mockAxax(data, status = 200) {
  return {
    get: async (url, cfg) => {
      return { status, data, url, cfg };
    },
  };
}

test('returns lat/lon swapped from GeoJSON [lon, lat]', async () => {
  const ax = mockAxax({
    metadata: { totaltAntallTreff: 1 },
    navn: [{
      geojson: { geometry: { coordinates: [10.73353, 59.91187], type: 'Point' } },
      stedsnavn: [{ skrivemåte: 'Oslo' }],
    }],
  });
  const r = await geocode('Oslo', { axiosInstance: ax });
  assert.equal(r.lat, 59.91187);
  assert.equal(r.lon, 10.73353);
  assert.equal(r.name, 'Oslo');
});

test('sends query params and headers', async () => {
  let seen;
  const ax = {
    get: async (url, cfg) => { seen = { url, cfg }; return { status: 200, data: { navn: [] } }; },
  };
  await assert.rejects(geocode('Nowhere', { axiosInstance: ax }), /no match/);
  assert.equal(seen.url, GEO_URL);
  assert.deepEqual(seen.cfg.params, { sok: 'Nowhere', fuzzy: true, treffPerSide: 1, utkoordsys: 4258 });
  assert.match(seen.cfg.headers['User-Agent'], /weather-cli/);
  assert.equal(seen.cfg.headers.Accept, 'application/json');
});

test('throws when navn is empty (HTTP 200 with no matches)', async () => {
  const ax = mockAxax({ metadata: { totaltAntallTreff: 0 }, navn: [] });
  await assert.rejects(geocode('Nonexistentplace123', { axiosInstance: ax }), /no match/);
});

test('falls back to query string when skrivemåte missing', async () => {
  const ax = mockAxax({
    navn: [{ geojson: { geometry: { coordinates: [5.3245, 60.39323] } } }],
  });
  const r = await geocode('Bergen', { axiosInstance: ax });
  assert.equal(r.name, 'Bergen');
  assert.equal(r.lat, 60.39323);
  assert.equal(r.lon, 5.3245);
});

test('throws when coordinates missing', async () => {
  const ax = mockAxax({ navn: [{ stedsnavn: [{ skrivemåte: 'X' }] }] });
  await assert.rejects(geocode('X', { axiosInstance: ax }), /no coordinates/);
});

test('propagates axios network errors', async () => {
  const ax = { get: async () => { throw new Error('ECONNRESET'); } };
  await assert.rejects(geocode('Oslo', { axiosInstance: ax }), /ECONNRESET/);
});
