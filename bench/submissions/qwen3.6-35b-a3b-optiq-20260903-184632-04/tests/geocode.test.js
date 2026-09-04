import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { geocode } from '../src/geocode.js';
import axios from 'axios';

const originalExit = process.exit;
let exitCode = null;

describe('Geocode', () => {
  let originalGet;

  before(() => {
    process.exit = (code) => {
      exitCode = code;
      throw new Error('exit');
    };
  });

  after(() => {
    process.exit = originalExit;
  });

  beforeEach(() => {
    exitCode = null;
    originalGet = axios.get;
  });

  afterEach(() => {
    axios.get = originalGet;
  });

  it('should return location data from Geonorge API', async () => {
    const mockResponse = {
      data: {
        navn: [{
          geometry: {
            coordinates: [10.73353, 59.91187]
          },
          stedsnavn: [{
            skrivemåte: 'Oslo'
          }]
        }]
      },
      status: 200
    };

    axios.get = async () => mockResponse;

    const result = await geocode('Oslo', 'weather-cli/1.0 test');
    assert.strictEqual(result.geometry.coordinates[0], 10.73353);
    assert.strictEqual(result.geometry.coordinates[1], 59.91187);
    assert.strictEqual(result.stedsnavn[0].skrivemåte, 'Oslo');
  });

  it('should exit with code 1 when location not found', async () => {
    axios.get = async () => ({
      data: { navn: [] },
      status: 200
    });

    try {
      await geocode('NonExistentPlace12345', 'weather-cli/1.0 test');
      assert.fail('Should have exited');
    } catch (err) {
      assert.strictEqual(exitCode, 1);
    }
  });

  it('should exit with code 1 on API error', async () => {
    axios.get = async () => {
      throw new Error('Network error');
    };

    try {
      await geocode('Oslo', 'weather-cli/1.0 test');
      assert.fail('Should have exited');
    } catch (err) {
      assert.strictEqual(exitCode, 1);
    }
  });

  it('should encode location name in URL', async () => {
    let capturedUrl = null;
    axios.get = async (url) => {
      capturedUrl = url;
      return { data: { navn: [] }, status: 200 };
    };

    try {
      await geocode('Oslo & Viken', 'weather-cli/1.0 test');
    } catch (err) {
      // Expected to exit due to no results
    }

    assert.ok(capturedUrl.includes(encodeURIComponent('Oslo & Viken')));
  });
});
