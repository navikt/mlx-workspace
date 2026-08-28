import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocode, USER_AGENT } from '../lib/geocode.js';

function fakeHttp(payload, captured = {}) {
  return {
    get: async (url, config) => {
      captured.url = url;
      captured.config = config;
      return { data: payload };
    },
  };
}

const oslo = {
  navn: [
    {
      fylker: [{ fylkesnavn: 'Oslo', fylkesnummer: '03' }],
      geojson: { geometry: { coordinates: [10.73353, 59.91187], type: 'Point' } },
      stedsnavn: [
        { navnestatus: 'hovednavn', skrivemåte: 'Oslo', skrivemåtestatus: 'godkjent og prioritert', språk: 'Norsk', stedsnavnnummer: 1 },
      ],
      stedsnummer: 509924,
      stedstatus: 'aktiv',
    },
  ],
};

test('maps navn[0] geojson [lon, lat] to {lat, lon} and picks primary name', async () => {
  const captured = {};
  const loc = await geocode('Oslo', { http: fakeHttp(oslo, captured) });
  assert.equal(loc.type, 'coords');
  assert.equal(loc.lat, 59.91187);
  assert.equal(loc.lon, 10.73353);
  assert.equal(loc.displayName, 'Oslo');
  assert.equal(captured.url, 'https://ws.geonorge.no/stedsnavn/v1/sted');
  assert.deepEqual(captured.config.params, { sok: 'Oslo', fuzzy: true, treffPerSide: 1, utkoordsys: 4326 });
  assert.equal(captured.config.headers['User-Agent'], USER_AGENT);
  assert.equal(captured.config.headers.Accept, 'application/json');
});

test('falls back to query string when no primary name', async () => {
  const payload = { navn: [{ geojson: { geometry: { coordinates: [5.3245, 60.39323] } } }] };
  const loc = await geocode('Bergen', { http: fakeHttp(payload) });
  assert.equal(loc.displayName, 'Bergen');
  assert.equal(loc.lat, 60.39323);
  assert.equal(loc.lon, 5.3245);
});

test('empty navn array throws', async () => {
  await assert.rejects(geocode('xyzzyq', { http: fakeHttp({ navn: [] }) }), /No place found/);
});

test('missing geojson throws', async () => {
  await assert.rejects(geocode('Nope', { http: fakeHttp({ navn: [{}] }) }), /No place found/);
});

test('propagates http errors', async () => {
  const http = { get: async () => { throw new Error('422 Unprocessable Entity'); } };
  await assert.rejects(geocode('', { http }), /422/);
});

test('strips navneobjekttype suffix from display name', async () => {
  const payload = {
    navn: [
      {
        navneobjekttype: 'Fylke',
        geojson: { geometry: { coordinates: [10.73353, 59.91187] } },
        stedsnavn: [
          { navnestatus: 'hovednavn', skrivemåte: 'Oslo fylke', språk: 'Norsk' },
          { navnestatus: 'hovednavn', skrivemåte: 'Oslo', språk: 'Norsk' },
        ],
      },
    ],
  };
  const loc = await geocode('Oslo', { http: fakeHttp(payload) });
  assert.equal(loc.displayName, 'Oslo');
});

test('prefers Norwegian primary name', async () => {
  const payload = {
    navn: [
      {
        geojson: { geometry: { coordinates: [10.39506, 63.43048] } },
        stedsnavn: [
          { navnestatus: 'hovednavn', skrivemåte: 'Trondheim', språk: 'Norsk' },
          { navnestatus: 'hovednavn', skrivemåte: 'Tråante', språk: 'Sørsamisk' },
        ],
      },
    ],
  };
  const loc = await geocode('Trondheim', { http: fakeHttp(payload) });
  assert.equal(loc.displayName, 'Trondheim');
});
