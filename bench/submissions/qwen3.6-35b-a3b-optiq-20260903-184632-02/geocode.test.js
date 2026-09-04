import { describe, it } from 'node:test';
import assert from 'node:assert';
import { geocodeGeonorge } from './geocode.js';

describe('geocode.js', () => {
  it('geocodes "Oslo" and returns coordinates', async () => {
    const result = await geocodeGeonorge('Oslo');
    assert.ok(result.lon, 'Should have longitude');
    assert.ok(result.lat, 'Should have latitude');
    assert.ok(result.displayName, 'Should have display name');
    assert.ok(typeof result.lon === 'number', 'Longitude should be a number');
    assert.ok(typeof result.lat === 'number', 'Latitude should be a number');
  });

  it('geocodes "Bergen" and returns coordinates', async () => {
    const result = await geocodeGeonorge('Bergen');
    assert.ok(result.lon, 'Should have longitude');
    assert.ok(result.lat, 'Should have latitude');
  });

  it('throws on non-existent place name', async () => {
    try {
      await geocodeGeonorge('xyznotarealplace12345');
      assert.fail('Should have thrown for non-existent place');
    } catch (error) {
      assert.ok(error.message.includes('No results') || error.message.includes('error'), `Error message should indicate failure: ${error.message}`);
    }
  });
});
