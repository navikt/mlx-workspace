import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocode } from './src/geocode.js';

const ok = (navn) => ({ get: async () => ({ data: { navn } }) });

test('uses representasjonspunkt (nord=lat, øst=lon) + first skrivemåte', async () => {
  const http = ok([{
    representasjonspunkt: { nord: 59.91, øst: 10.73 },
    stedsnavn: [{ skrivemåte: 'Oslo' }],
  }]);
  const r = await geocode('Oslo', http);
  assert.equal(r.lat, 59.91);
  assert.equal(r.lon, 10.73);
  assert.equal(r.name, 'Oslo');
});

test('falls back to GeoJSON [lon, lat]', async () => {
  const http = ok([{
    geojson: { geometry: { coordinates: [10.73, 59.91] } },
    stedsnavn: [{ skrivemåte: 'Bergen' }],
  }]);
  const r = await geocode('Bergen', http);
  assert.equal(r.lat, 59.91);
  assert.equal(r.lon, 10.73);
  assert.equal(r.name, 'Bergen');
});

test('zero hits -> throws', async () => {
  await assert.rejects(() => geocode('XYZ', ok([])), /No place found/);
});

test('http error -> throws', async () => {
  const http = { get: async () => { throw new Error('boom'); } };
  await assert.rejects(() => geocode('Oslo', http), /Geocoding failed/);
});

test('missing coordinates -> throws', async () => {
  const http = ok([{ stedsnavn: [{ skrivemåte: 'Oslo' }] }]);
  await assert.rejects(() => geocode('Oslo', http), /no coordinates/);
});
