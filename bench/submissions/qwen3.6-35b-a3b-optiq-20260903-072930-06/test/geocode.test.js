import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

// Mock axios for geocode tests
describe('geocode', () => {
  const originalGet = axios.get;

  it('returns lat/lon and displayName from Geonorge response', async () => {
    const mockResponse = {
      navn: [
        {
          geojson: {
            geometry: {
              coordinates: [10.73353, 59.91187],
              type: 'Point',
            },
          },
          stedsnavn: [
            { skrivemåte: 'Oslo fylke' },
            { skrivemåte: 'Oslo' },
          ],
          navneobjekttype: 'Fylke',
        },
      ],
    };

    mock.method(axios, 'get', () => Promise.resolve({ data: mockResponse }));

    const { geocode } = await import('../geocode.js');
    const result = await geocode('Oslo');

    assert.strictEqual(result.lat, 59.91187);
    assert.strictEqual(result.lon, 10.73353);
    assert.strictEqual(result.displayName, 'Oslo fylke');
  });

  it('throws when no results found', async () => {
    const mockResponse = {
      navn: [],
    };

    mock.method(axios, 'get', () => Promise.resolve({ data: mockResponse }));

    const { geocode } = await import('../geocode.js');

    try {
      await geocode('NonExistentPlace123');
      assert.fail('Should have thrown');
    } catch (error) {
      assert.ok(error.message.includes('No location found'));
    }
  });

  it('passes encoded location name to API URL', async () => {
    let capturedUrl = '';

    mock.method(axios, 'get', (url) => {
      capturedUrl = url;
      return Promise.resolve({ data: { navn: [] } });
    });

    const { geocode } = await import('../geocode.js');

    try {
      await geocode('St. Hans');
    } catch (_) {
      // Expected to fail due to empty navn
    }

    assert.ok(capturedUrl.includes('St.%20Hans'));
  });

  it('sets correct headers', async () => {
    let capturedConfig = {};

    mock.method(axios, 'get', (_url, config) => {
      capturedConfig = config || {};
      return Promise.resolve({ data: { navn: [] } });
    });

    const { geocode } = await import('../geocode.js');

    try {
      await geocode('Test');
    } catch (_) {
      // Expected to fail due to empty navn
    }

    assert.strictEqual(capturedConfig.headers['User-Agent'], 'weather-cli/1.0 (test@weather-cli.dev)');
    assert.strictEqual(capturedConfig.headers['Accept'], 'application/json');
  });
});
