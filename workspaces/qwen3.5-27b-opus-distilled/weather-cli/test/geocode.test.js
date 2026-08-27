import { expect } from 'chai';
import nock from 'nock';
import { geocode } from '../src/geocode.js';

describe('geocode', () => {
  const geonorgeScope = nock('https://ws.geonorge.no');

  afterEach(() => {
    nock.cleanAll();
  });

  it('should geocode Oslo', async () => {
    geonorgeScope
      .get('/stedsnavn/v1/sted')
      .query((q) => {
        return q.sok === 'Oslo' && q.fuzzy === 'true' && q.treffPerSide === '1';
      })
      .reply(200, {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [10.7522, 59.9139] // [lon, lat]
            },
            properties: {
              navn: 'Oslo'
            }
          }
        ]
      });

    const result = await geocode('Oslo');
    
    expect(result.success).to.equal(true);
    expect(result.lat).to.equal(59.9139);
    expect(result.lon).to.equal(10.7522);
    expect(result.name).to.equal('Oslo');
  });

  it('should geocode Bergen', async () => {
    geonorgeScope
      .get('/stedsnavn/v1/sted')
      .query((q) => q.sok === 'Bergen')
      .reply(200, {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [5.3220, 60.3913]
            },
            properties: {
              navn: 'Bergen'
            }
          }
        ]
      });

    const result = await geocode('Bergen');
    
    expect(result.success).to.equal(true);
    expect(result.lat).to.equal(60.3913);
    expect(result.lon).to.equal(5.3220);
  });

  it('should handle empty results', async () => {
    geonorgeScope
      .get('/stedsnavn/v1/sted')
      .query((q) => q.sok.includes('NonExistent'))
      .reply(200, {
        type: 'FeatureCollection',
        features: []
      });

    const result = await geocode('NonExistentPlace12345');
    
    expect(result.success).to.equal(false);
    expect(result.error).to.include('No location found');
  });

  it('should handle API errors', async () => {
    geonorgeScope
      .get('/stedsnavn/v1/sted')
      .reply(500, '{"error": "Internal Server Error"}');

    const result = await geocode('Oslo');
    
    expect(result.success).to.equal(false);
    expect(result.error).to.include('Geocoding API error');
  });

  it('should use fuzzy matching for partial names', async () => {
    geonorgeScope
      .get('/stedsnavn/v1/sted')
      .query((q) => q.sok.includes('Osl'))
      .reply(200, {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [10.7522, 59.9139]
            },
            properties: {
              navn: 'Oslo'
            }
          }
        ]
      });

    const result = await geocode('Osl');
    
    expect(result.success).to.equal(true);
    expect(result.name).to.equal('Oslo');
  });
});
