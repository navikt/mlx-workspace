const { geocode } = require('./geocode');
const { expect } = require('chai');
const nock = require('nock');

describe('geocode', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should return { lat, lon } for a valid location name', async () => {
    const scope = nock('https://ws.geonorge.no')
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
    const scope = nock('https://ws.geonorge.no')
      .get('/stedsnavn/v1/sted')
      .reply(200, { navn: [] });

    await expect(geocode('NonExistentPlace12345')).to.be.rejectedWith(/not found/);
  });

  it('should throw when no coordinates in response', async () => {
    const scope = nock('https://ws.geonorge.no')
      .get('/stedsnavn/v1/sted')
      .reply(200, {
        navn: [
          {
            geojson: {
              geometry: null,
            },
          },
        ],
      });

    await expect(geocode('Oslo')).to.be.rejectedWith(/No coordinates/);
  });

  it('should throw on API error', async () => {
    const scope = nock('https://ws.geonorge.no')
      .get('/stedsnavn/v1/sted')
      .reply(500);

    await expect(geocode('Oslo')).to.be.rejected();
  });
});
