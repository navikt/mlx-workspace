'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { geocode, GEONORGE_URL } = require('./geocode');

const osloResponse = {
  metadata: { totaltAntallTreff: 125, treffPerSide: 1 },
  navn: [
    {
      fylker: [{ fylkesnavn: 'Oslo', fylkesnummer: '03' }],
      geojson: { geometry: { coordinates: [10.73353, 59.91187], type: 'Point' } },
      kommuner: [{ kommunenavn: 'Oslo', kommunenummer: '0301' }],
      navneobjekttype: 'Fylke',
      representasjonspunkt: { nord: 59.91187, øst: 10.73353 },
      stedsnavn: [
        { navnestatus: 'hovednavn', skrivemåte: 'Oslo fylke', språk: 'Norsk' },
        { navnestatus: 'hovednavn', skrivemåte: 'Oslo', språk: 'Norsk' },
      ],
      stedsnummer: 509924,
      stedstatus: 'aktiv',
    },
  ],
};

function mockHttp(data) {
  return {
    get: async (url, config) => {
      return { data, url, config };
    },
  };
}

test('maps first Geonorge match to {name, lat, lon}', async () => {
  const result = await geocode('Oslo', { http: mockHttp(osloResponse) });
  assert.strictEqual(result.name, 'Oslo fylke');
  assert.strictEqual(result.lat, 59.91187);
  assert.strictEqual(result.lon, 10.73353);
});

test('uses representasjonspunkt nord/øst (lat/lon, not geojson lon/lat)', async () => {
  const result = await geocode('Oslo', { http: mockHttp(osloResponse) });
  assert.ok(result.lat > 50 && result.lat < 70, 'lat should be a Norwegian latitude');
  assert.ok(result.lon > 4 && result.lon < 13, 'lon should be a Norwegian longitude');
});

test('falls back to first stedsnavn when no hovednavn', async () => {
  const data = JSON.parse(JSON.stringify(osloResponse));
  data.navn[0].stedsnavn = [{ navnestatus: 'annenvare', skrivemåte: 'Oslo2' }];
  const result = await geocode('Oslo', { http: mockHttp(data) });
  assert.strictEqual(result.name, 'Oslo2');
});

test('throws when navn is empty', async () => {
  await assert.rejects(geocode('Nope', { http: mockHttp({ navn: [] }) }), /no match/);
});

test('throws when navn is missing', async () => {
  await assert.rejects(geocode('Nope', { http: mockHttp({}) }), /no match/);
});

test('requests the Geonorge endpoint with search params and headers', async () => {
  let captured;
  const http = {
    get: async (url, config) => {
      captured = { url, config };
      return { data: osloResponse };
    },
  };
  await geocode('Bergen', { http });
  assert.strictEqual(captured.url, GEONORGE_URL);
  assert.deepStrictEqual(captured.config.params, {
    sok: 'Bergen',
    fuzzy: true,
    treffPerSide: 1,
    utkoordsys: 4258,
  });
  assert.match(captured.config.headers['User-Agent'], /^weather-cli\/1\.0 /);
  assert.strictEqual(captured.config.headers.Accept, 'application/json');
});
