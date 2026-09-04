import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import { geocode } from '../src/weather.js';

// Mock axios
const originalAxios = axios;

describe('Geocode', () => {
  let mockResponse;

  beforeEach(() => {
    // Create a mock geonorge response based on real API structure
    mockResponse = {
      navn: [
        {
          geojson: {
            geometry: {
              type: 'Point',
              coordinates: [10.73353, 59.91187] // [lon, lat]
            }
          },
          stedsnavn: [
            {
              skrivemåte: 'Oslo',
              navnestatus: 'hovednavn',
              språk: 'Norsk'
            }
          ]
        }
      ]
    };

    // Override axios.get
    axios.get = async () => ({ data: mockResponse });
  });

  afterEach(() => {
    axios.get = originalAxios.get;
  });

  it('should return lat, lon, and locationName from geocode response', async () => {
    const result = await geocode('Oslo');
    assert.strictEqual(result.lat, 59.91187);
    assert.strictEqual(result.lon, 10.73353);
    assert.strictEqual(result.locationName, 'Oslo');
  });

  it('should swap coordinates from GeoJSON [lon, lat] to [lat, lon]', async () => {
    mockResponse.navn[0].geojson.geometry.coordinates = [5.3228, 60.3913]; // Bergen
    const result = await geocode('Bergen');
    assert.strictEqual(result.lat, 60.3913);
    assert.strictEqual(result.lon, 5.3228);
  });

  it('should use the provided name when no stedsnavn exists', async () => {
    mockResponse.navn[0].stedsnavn = [];
    const result = await geocode('UnknownPlace');
    assert.strictEqual(result.locationName, 'UnknownPlace');
  });

  it('should throw when no results found', async () => {
    mockResponse.navn = [];
    await assert.rejects(
      geocode('NonExistentPlace12345'),
      /Could not find location/
    );
  });

  it('should throw on API error', async () => {
    axios.get = async () => {
      throw new Error('Network Error');
    };
    await assert.rejects(
      geocode('Oslo'),
      /Network Error/
    );
  });
});
