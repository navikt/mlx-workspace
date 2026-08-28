import test from 'node:test';
import assert from 'node:assert/strict';
import { geocode, toPlace } from '../src/geocode.js';

const payload = {
  metadata: { totaltAntallTreff: 1 },
  navn: [
    {
      stedsnavn: [{ skrivemåte: 'Oslo', navnestatus: 'hovednavn' }],
      geojson: { geometry: { type: 'Point', coordinates: [10.73353, 59.91187] } },
      representasjonspunkt: { nord: 59.91187, øst: 10.73353 },
    },
  ],
};

test('toPlace swaps GeoJSON [lon, lat] to lat/lon', () => {
  const place = toPlace(payload, 'Oslo');
  assert.equal(place.lat, 59.91187);
  assert.equal(place.lon, 10.73353);
  assert.equal(place.name, 'Oslo');
});

test('toPlace prefers the shortest stedsnavn form', () => {
  const p = toPlace(
    {
      navn: [
        {
          stedsnavn: [{ skrivemåte: 'Oslo fylke' }, { skrivemåte: 'Oslo' }],
          geojson: { geometry: { type: 'Point', coordinates: [10.73353, 59.91187] } },
        },
      ],
    },
    'Oslo',
  );
  assert.equal(p.name, 'Oslo');
});

test('toPlace falls back to representasjonspunkt when geojson is absent', () => {
  const p = toPlace(
    { navn: [{ stedsnavn: [{ skrivemåte: 'X' }], representasjonspunkt: { nord: 1, øst: 2 } }] },
    'X',
  );
  assert.equal(p.lat, 1);
  assert.equal(p.lon, 2);
});

test('toPlace throws when there are no hits', () => {
  assert.throws(() => toPlace({ navn: [] }, 'Nowhere'), /not found/);
  assert.throws(() => toPlace({}, 'Nowhere'), /not found/);
});

test('toPlace throws when a hit has no coordinates', () => {
  assert.throws(() => toPlace({ navn: [{ stedsnavn: [{ skrivemåte: 'X' }] }] }, 'X'), /No coordinates/);
});

test('geocode sends the stedsnavn query params and identifying headers', async () => {
  let req;
  const http = async (url, config) => {
    req = { url, config };
    return { data: payload };
  };
  const place = await geocode('Oslo', http);
  assert.equal(place.lat, 59.91187);
  assert.match(req.url, /^https:\/\/ws\.geonorge\.no\/stedsnavn\/v1\/sted$/);
  assert.deepEqual(req.config.params, {
    sok: 'Oslo',
    fuzzy: true,
    treffPerSide: 1,
    utkoordsys: 4258,
  });
  assert.match(req.config.headers['User-Agent'], /weather-cli/);
  assert.equal(req.config.headers.Accept, 'application/json');
});

test('geocode propagates HTTP errors', async () => {
  const http = async () => {
    throw new Error('Request failed with status code 403');
  };
  await assert.rejects(() => geocode('Oslo', http), /403/);
});
