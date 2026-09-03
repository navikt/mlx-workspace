import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { geocodeLocation } from '../weather.js';
import axios from 'axios';

// Mock axios for geocoding tests
const originalGet = axios.get;

describe('geocode', () => {
  let mockAxiosGet;

  before(() => {
    // Replace axios.get with our mock
    axios.get = async (url, config) => {
      return mockAxiosGet(url, config);
    };
  });

  after(() => {
    axios.get = originalGet;
  });

  it('should geocode a location name and convert UTM to WGS84', async () => {
    // Mock Geonorge response with WGS84 coordinates (representasjonspunkt)
    mockAxiosGet = async (url, config) => {
      assert.ok(url.includes('ws.geonorge.no'), 'Should call Geonorge API');
      assert.ok(config.params.sok === 'Oslo', 'Should pass location name');
      assert.equal(config.headers['User-Agent'], 'weather-cli/1.0 github.com/weather-cli', 'Should include User-Agent');
      assert.equal(config.headers['Accept'], 'application/json', 'Should include Accept header');

      return {
        data: {
          navn: [
            {
              navn: 'Oslo',
              representasjonspunkt: {
                nord: 59.91187,
                'øst': 10.73353,
              },
            },
          ],
        },
      };
    };

    const result = await geocodeLocation('Oslo');
    assert.ok(result.lat, 'Should have latitude');
    assert.ok(result.lon, 'Should have longitude');
    assert.equal(result.name, 'Oslo', 'Should return location name');
    // Oslo should be roughly around 59-61°N, 10-12°E
    assert.ok(result.lat > 59 && result.lat < 61, `Lat should be ~60, got ${result.lat}`);
    assert.ok(result.lon > 10 && result.lon < 12, `Lon should be ~11, got ${result.lon}`);
  });

  it('should throw when no results found', async () => {
    mockAxiosGet = async () => ({
      data: { navn: [] },
    });

    try {
      await geocodeLocation('NonexistentPlace12345');
      assert.fail('Should have thrown');
    } catch (error) {
      assert.ok(error.message.includes('No results'), 'Should mention no results');
    }
  });

  it('should throw on API error', async () => {
    mockAxiosGet = async () => {
      const error = new Error('Network Error');
      error.response = { status: 500, statusText: 'Internal Server Error' };
      throw error;
    };

    try {
      await geocodeLocation('Oslo');
      assert.fail('Should have thrown');
    } catch (error) {
      assert.ok(error.message.includes('Geonorge API error'), 'Should mention Geonorge API error');
    }
  });
});
