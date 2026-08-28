const { geocode } = require('./geocode');
const { expect } = require('chai');
const nock = require('nock');

describe('geocode', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should return { lat, lon } for a valid location name', async () => {
    nock('https://ws.geonorge.no')
      .get('/stedsnavn/v1/sted')
      .query({
        sok: 'Oslo',
        fuzzy: 'true',
        treffPerSide: '1',
        utkoordsys: '4258',
      })
      .reply(200, {
        navn: [
          {
            geojson: {
              geometry: {
                type: 'Point',
                coordinates: [10.73353, 59.91187],
              },
            },
          },
        ],
      });

    const result = await geocode('Oslo');
    expect(result).to.deep.equal({ lat: 59.91187, lon: 10.73353 });
  });

  it('should throw when no results returned', async () => {
    nock('https://ws.geonorge.no')
      .get('/stedsnavn/v1/sted')
      .query(true)
      .reply(200, { navn: [] });

    try {
      await geocode('NonExistentPlace12345');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).to.include('not found');
    }
  });

  it('should throw when no coordinates in response', async () => {
    nock('https://ws.geonorge.no')
      .get('/stedsnavn/v1/sted')
      .query(true)
      .reply(200, {
        navn: [
          {
            geojson: {
              geometry: null,
            },
          },
        ],
      });

    try {
      await geocode('Oslo');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).to.include('No coordinates');
    }
  });

  it('should throw on API error', async () => {
    nock('https://ws.geonorge.no')
      .get('/stedsnavn/v1/sted')
      .reply(500);

    try {
      await geocode('Oslo');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).to.be.a('string');
    }
  });
});
