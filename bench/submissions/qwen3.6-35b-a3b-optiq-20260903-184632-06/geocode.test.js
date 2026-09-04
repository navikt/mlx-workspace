import assert from 'node:assert';
import { test } from 'node:test';
import axios from 'axios';
import { geocode } from './src/geocode.js';

const mockAxiosGet = axios.get;

function createMockResponse(geonorgeData) {
  return {
    data: geonorgeData,
    status: 200,
  };
}

test('geocode returns lat/lon swapped from GeoJSON coords', async () => {
  const mockData = {
    metadata: { totaltAntallTreff: 1 },
    navn: [{
      geojson: { geometry: { coordinates: [10.73353, 59.91187] } },
      stedsnavn: [{ skrivemåte: 'Oslo' }],
    }],
  };

  axios.get = async () => createMockResponse(mockData);

  const result = await geocode('Oslo');
  assert.strictEqual(result.lat, 59.91187);
  assert.strictEqual(result.lon, 10.73353);
  assert.strictEqual(result.name, 'Oslo');

  axios.get = mockAxiosGet;
});

test('geocode extracts first skrivemåte as name', async () => {
  const mockData = {
    metadata: { totaltAntallTreff: 1 },
    navn: [{
      geojson: { geometry: { coordinates: [5.3228, 60.3913] } },
      stedsnavn: [
        { skrivemåte: 'Bergen kommune' },
        { skrivemåte: 'Bergen' },
      ],
    }],
  };

  axios.get = async () => createMockResponse(mockData);

  const result = await geocode('Bergen');
  assert.strictEqual(result.name, 'Bergen kommune');

  axios.get = mockAxiosGet;
});

test('geocode throws when no results found', async () => {
  const mockData = {
    metadata: { totaltAntallTreff: 0 },
    navn: [],
  };

  axios.get = async () => createMockResponse(mockData);

  try {
    await geocode('NonExistentPlace12345');
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('Location not found'));
  }

  axios.get = mockAxiosGet;
});

test('geocode URL-encodes location name', async () => {
  let capturedUrl = '';
  axios.get = async (url) => {
    capturedUrl = url;
    return createMockResponse({
      metadata: { totaltAntallTreff: 1 },
      navn: [{
        geojson: { geometry: { coordinates: [10.0, 60.0] } },
        stedsnavn: [{ skrivemåte: 'Test' }],
      }],
    });
  };

  await geocode('St. Moritz');
  assert.ok(capturedUrl.includes('St.%20Moritz'));

  axios.get = mockAxiosGet;
});

test('geocode uses correct headers', async () => {
  let capturedHeaders = {};
  axios.get = async (_url, config) => {
    capturedHeaders = config.headers;
    return createMockResponse({
      metadata: { totaltAntallTreff: 1 },
      navn: [{
        geojson: { geometry: { coordinates: [10.0, 60.0] } },
        stedsnavn: [{ skrivemåte: 'Test' }],
      }],
    });
  };

  await geocode('Test');
  const userAgent = capturedHeaders['User-Agent'] || capturedHeaders['user-agent'] || capturedHeaders.UserAgent;
  assert.ok(userAgent, `Headers: ${JSON.stringify(capturedHeaders)}`);
  assert.ok(!userAgent.includes('example.com'));
  const accept = capturedHeaders.Accept || capturedHeaders.accept;
  assert.strictEqual(accept, 'application/json');

  axios.get = mockAxiosGet;
});

test('geocode handles missing stedsnavn array', async () => {
  const mockData = {
    metadata: { totaltAntallTreff: 1 },
    navn: [{
      geojson: { geometry: { coordinates: [10.0, 60.0] } },
      stedsnavn: undefined,
    }],
  };

  axios.get = async () => createMockResponse(mockData);

  const result = await geocode('Test');
  assert.strictEqual(result.name, 'Test');

  axios.get = mockAxiosGet;
});
