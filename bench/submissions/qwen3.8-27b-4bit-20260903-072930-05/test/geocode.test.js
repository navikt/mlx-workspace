import test from 'node:test';
import assert from 'node:assert/strict';
import { geocode, USER_AGENT } from '../src/geocode.js';

function fakeHttp(body) {
  return async (url, config) => ({ data: body, config, url });
}

test('swaps GeoJSON [lon, lat] to lat/lon', async () => {
  const http = fakeHttp({ navn: [{ geojson: { geometry: { type: 'Point', coordinates: [10.73353, 59.91187] } } }] });
  const geo = await geocode('Oslo', { http });
  assert.equal(geo.lat, 59.91187);
  assert.equal(geo.lon, 10.73353);
  assert.equal(geo.name, 'Oslo');
});

test('prefers the canonical primary name from the response', async () => {
  const http = fakeHttp({
    navn: [{
      geojson: { geometry: { type: 'Point', coordinates: [10.73353, 59.91187] } },
      stedsnavn: [
        { navnestatus: 'hovednavn', skrivemåte: 'Oslo', språk: 'Norsk' },
        { navnestatus: 'annat', skrivemåte: 'Other', språk: 'Engelsk' },
      ],
    }],
  });
  const geo = await geocode('oslo', { http });
  assert.equal(geo.name, 'Oslo');
});

test('falls back to the user input when no name is present', async () => {
  const http = fakeHttp({ navn: [{ geojson: { geometry: { type: 'Point', coordinates: [5, 6] } } }] });
  const geo = await geocode('Bergen', { http });
  assert.equal(geo.name, 'Bergen');
});

test('URL-encodes the search term', async () => {
  let seen;
  const http = async (url) => { seen = url; return { data: { navn: [] } }; };
  await assert.rejects(geocode('Ålesund', { http }));
  assert.match(seen, /sok=%C3%85lesund/);
});

test('URL-encodes spaces and query characters', async () => {
  let seen;
  const http = async (url) => { seen = url; return { data: { navn: [] } }; };
  await assert.rejects(geocode('a b?c&d', { http }));
  assert.match(seen, /sok=a%20b%3Fc%26d/);
});

test('empty navn array fails', async () => {
  await assert.rejects(geocode('Nowhere', { http: fakeHttp({ navn: [] }) }), /no Norwegian place found/);
});

test('missing geometry fails', async () => {
  await assert.rejects(geocode('Oslo', { http: fakeHttp({ navn: [{ navneobjekttype: 'Fylke' }] }) }), /no Norwegian place found/);
});

test('sends User-Agent and Accept headers', async () => {
  let config;
  const http = async (url, c) => { config = c; return { data: { navn: [] } }; };
  await assert.rejects(geocode('Oslo', { http, userAgent: 'test-agent/9.9' }));
  assert.equal(config.headers['User-Agent'], 'test-agent/9.9');
  assert.equal(config.headers.Accept, 'application/json');
});

test('default User-Agent identifies the app with a real contact', () => {
  assert.match(USER_AGENT, /^weather-cli\/1\.0 /);
  assert.doesNotMatch(USER_AGENT, /example\.com/);
});
