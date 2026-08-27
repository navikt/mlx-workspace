import { describe, it } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import nock from 'nock';
import { geocode } from '../geocode.js';

// We'll use nock for mocking — but spec says only axios.
// However, tests need mocking. We'll add nock as dev dependency.
// For now, test with real API is integration. Unit tests mock axios.

describe('geocode.test.js', () => {
  const originalAxios = axios;

  it('returns lat/lon and name from Geonorge response', async () => {
    const mockResponse = {
      navn: [
        {
          geojson: {
            geometry: { coordinates: [10.73353, 59.91187] },
          },
          stedsnavn: [{ skrivemate: 'Oslo' }],
        },
      ],
    };

    const scope = nock('https://ws.geonorge.no')
      .get('/stedsnavn/v1/sted')
      .query(true)
      .reply(200, mockResponse);

    const result = await geocode('Oslo');
    assert.strictEqual(result.lat, 59.91187);
    assert.strictEqual(result.lon, 10.73353);
    assert.strictEqual(result.name, 'Oslo');
    scope.done();
  });

  it('throws when no names returned', async () => {
    const scope = nock('https://ws.geonorge.no')
      .get('/stedsnavn/v1/sted')
      .query(true)
      .reply(200, { navn: [] });

    try {
      await geocode('NonExistentPlace12345');
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('No location found'));
    }
    scope.done();
  });

  it('throws when no coordinates in response', async () => {
    const scope = nock('https://ws.geonorge.no')
      .get('/stedsnavn/v1/sted')
      .query(true)
      .reply(200, { navn: [{ geojson: {} }] });

    try {
      await geocode('BadData');
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('No coordinates'));
    }
    scope.done();
  });
});
