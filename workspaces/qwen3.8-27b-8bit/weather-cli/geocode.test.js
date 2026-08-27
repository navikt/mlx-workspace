import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocode, USER_AGENT } from './geocode.js';

function fakeHttp(payload) {
  const calls = [];
  return {
    calls,
    get: async (url, opts) => {
      calls.push({ url, opts });
      return { data: payload };
    },
  };
}

const osloPayload = {
  navn: [
    {
      geojson: { geometry: { coordinates: [10.73353, 59.91187], type: 'Point' } },
      stedsnavn: [{ skrivemåte: 'Oslo', navnestatus: 'hovednavn' }],
    },
  ],
};

test('resolves name → {lat, lon, name} with swapped coordinates', async () => {
  const http = fakeHttp(osloPayload);
  const result = await geocode('Oslo', http);
  assert.deepEqual(result, { lat: 59.91187, lon: 10.73353, name: 'Oslo' });
});

test('sends required params and headers', async () => {
  const http = fakeHttp(osloPayload);
  await geocode('Bergen', http);
  const { url, opts } = http.calls[0];
  assert.equal(url, 'https://ws.geonorge.no/stedsnavn/v1/sted');
  assert.deepEqual(opts.params, { sok: 'Bergen', fuzzy: true, treffPerSide: 1, utkoordsys: 4258 });
  assert.equal(opts.headers['User-Agent'], USER_AGENT);
  assert.equal(opts.headers.Accept, 'application/json');
});

test('empty navn → throw', async () => {
  const http = fakeHttp({ navn: [] });
  await assert.rejects(() => geocode('Zzqqxyz', http), /Location not found: Zzqqxyz/);
});

test('missing navn key → throw', async () => {
  const http = fakeHttp({});
  await assert.rejects(() => geocode('Oslo', http), /Location not found/);
});
