'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { geocode, GEO_NORGE_URL, USER_AGENT } = require('../src/geocode');

function makeHttp(body, { status = 200, error } = {}) {
  return {
    get: async (url, config) => {
      if (error) {
        throw Object.assign(new Error(error.message), { response: { status: error.status, data: error.body } });
      }
      return { status, data: body, config };
    },
  };
}

test('user agent identifies the app with a real contact', () => {
  assert.match(USER_AGENT, /^weather-cli\/1\.0\s+\S+$/);
  assert.doesNotMatch(USER_AGENT, /example\.com/i);
});

test('extracts lon lat from geojson and swaps to lat lon', async () => {
  const body = {
    metadata: { totaltAntallTreff: 1 },
    navn: [
      {
        navn: 'Oslo',
        geojson: {
          geometry: { type: 'Point', coordinates: [10.73353, 59.91187] },
        },
      },
    ],
  };
  const result = await geocode('Oslo', { http: makeHttp(body) });
  assert.strictEqual(result.name, 'Oslo');
  assert.strictEqual(result.lon, 10.73353);
  assert.strictEqual(result.lat, 59.91187);
});

test('encodes the name into the URL instead of concatenating it', async () => {
  let seenUrl = null;
  const http = {
    get: async (url) => {
      seenUrl = url;
      return {
        status: 200,
        data: { navn: [{ geojson: { geometry: { coordinates: [1, 2] } } }] },
      };
    },
  };
  await geocode('Oslo&fuzzy=false', { http });
  assert.ok(seenUrl.startsWith(`${GEO_NORGE_URL}?`));
  assert.ok(seenUrl.includes('sok=Oslo%26fuzzy%3Dfalse'));
  assert.doesNotMatch(seenUrl, /sok=Oslo&fuzzy/);
});

test('sends required query parameters', async () => {
  let seenUrl = null;
  const http = {
    get: async (url) => {
      seenUrl = url;
      return {
        status: 200,
        data: { navn: [{ geojson: { geometry: { coordinates: [1, 2] } } }] },
      };
    },
  };
  await geocode('Bergen', { http });
  const query = new URL(seenUrl).searchParams;
  assert.strictEqual(query.get('sok'), 'Bergen');
  assert.strictEqual(query.get('fuzzy'), 'true');
  assert.strictEqual(query.get('treffPerSide'), '1');
  assert.strictEqual(query.get('utkoordsys'), '4258');
});

test('sends user agent and accept headers', async () => {
  let seenConfig = null;
  const http = {
    get: async (url, config) => {
      seenConfig = config;
      return {
        status: 200,
        data: { navn: [{ geojson: { geometry: { coordinates: [1, 2] } } }] },
      };
    },
  };
  await geocode('Trondheim', { http, userAgent: 'test-agent/1.0 contact@test' });
  assert.strictEqual(seenConfig.headers['User-Agent'], 'test-agent/1.0 contact@test');
  assert.strictEqual(seenConfig.headers.Accept, 'application/json');
});

test('zero matches throws with exit code 1', async () => {
  const http = makeHttp({ metadata: { totaltAntallTreff: 0 }, navn: [] });
  await assert.rejects(
    geocode('Nowhere', { http }),
    (error) => {
      assert.match(error.message, /No place found/);
      assert.strictEqual(error.exitCode, 1);
      return true;
    }
  );
});

test('missing coordinates in the match throws with exit code 1', async () => {
  const http = makeHttp({ navn: [{ navn: 'X' }] });
  await assert.rejects(
    geocode('X', { http }),
    (error) => {
      assert.strictEqual(error.exitCode, 1);
      return true;
    }
  );
});

test('http failure is reported with exit code 1', async () => {
  const http = makeHttp(null, { error: { status: 500, message: 'boom' } });
  await assert.rejects(
    geocode('Oslo', { http }),
    (error) => {
      assert.match(error.message, /Geocoding failed/);
      assert.match(error.message, /500/);
      assert.strictEqual(error.exitCode, 1);
      return true;
    }
  );
});
