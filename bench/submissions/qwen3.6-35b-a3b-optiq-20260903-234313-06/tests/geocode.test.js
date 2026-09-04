import { describe, it, mock, before, after } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';

describe('Geocode', () => {
  let originalEnv;

  before(() => {
    originalEnv = process.env;
  });

  after(() => {
    process.env = originalEnv;
  });

  it('should geocode a location name and return lat/lon/name', async () => {
    // Mock the axios response with real Geonorge structure
    const mockResponse = {
      data: {
        metadata: {
          totaltAntallTreff: 125,
        },
        navn: [
          {
            stedsnummer: 509924,
            geojson: {
              geometry: {
                type: 'Point',
                coordinates: [10.73353, 59.91187], // [lon, lat] in GeoJSON
              },
            },
            stedsnavn: [
              {
                skrivemåte: 'Oslo fylke',
              },
              {
                skrivemåte: 'Oslo',
              },
            ],
          },
        ],
      },
    };

    mock.method(axios, 'get', () => Promise.resolve(mockResponse));

    const { geocode } = await import('../src/geocode.js');
    const result = await geocode('Oslo');

    assert.strictEqual(result.lat, 59.91187);
    assert.strictEqual(result.lon, 10.73353);
    assert.strictEqual(result.name, 'Oslo fylke');
  });

  it('should throw when no matches found', async () => {
    const mockResponse = {
      data: {
        metadata: {
          totaltAntallTreff: 0,
        },
        navn: [],
      },
    };

    mock.method(axios, 'get', () => Promise.resolve(mockResponse));

    const { geocode } = await import('../src/geocode.js');

    await assert.rejects(
      geocode('xyznonexistent12345'),
      /No location found/
    );
  });

  it('should throw on API error response', async () => {
    const error = {
      response: {
        status: 500,
        statusText: 'Internal Server Error',
      },
    };

    mock.method(axios, 'get', () => Promise.reject(error));

    const { geocode } = await import('../src/geocode.js');

    await assert.rejects(
      geocode('Oslo'),
      /Geonorge API error: 500/
    );
  });

  it('should use correct API URL and headers', async () => {
    let capturedUrl = '';
    let capturedHeaders = {};

    mock.method(axios, 'get', (url, config) => {
      capturedUrl = url;
      capturedHeaders = config?.headers || {};
      return Promise.resolve({ data: { navn: [] } });
    });

    const { geocode } = await import('../src/geocode.js');

    try {
      await geocode('Bergen');
    } catch (e) {
      // Expected to fail on empty navn
    }

    assert.ok(capturedUrl.includes('sok=Bergen'));
    assert.ok(capturedUrl.includes('fuzzy=true'));
    assert.ok(capturedUrl.includes('treffPerSide=1'));
    assert.ok(capturedUrl.includes('utkoordsys=4258'));
    assert.strictEqual(capturedHeaders['User-Agent'], 'weather-cli/1.0 test@example.com');
    assert.strictEqual(capturedHeaders['Accept'], 'application/json');
  });

  it('should handle place without stedsnavn array', async () => {
    const mockResponse = {
      data: {
        navn: [
          {
            geojson: {
              geometry: {
                coordinates: [5.3245, 60.39323],
              },
            },
            stedsnavn: null,
          },
        ],
      },
    };

    mock.method(axios, 'get', () => Promise.resolve(mockResponse));

    const { geocode } = await import('../src/geocode.js');
    const result = await geocode('Bergen');

    assert.strictEqual(result.lat, 60.39323);
    assert.strictEqual(result.lon, 5.3245);
    assert.strictEqual(result.name, 'Bergen');
  });
});
