import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import { geocode } from '../src/geocode.js';

describe('geocode', () => {
  const GEONORGE_URL = 'https://ws.geonorge.no';

  beforeEach(() => {
    nock.cleanAll();
  });

  it('returns lat, lon, and placeName for a valid location', async () => {
    const mockResponse = {
      metadata: {
        side: 1,
        totaltAntallTreff: 125,
        treffPerSide: 1,
        viserFra: 1,
        viserTil: 1
      },
      navn: [
        {
          stedsnummer: 509924,
          stedstatus: 'aktiv',
          navneobjekttype: 'Fylke',
          geojson: {
            geometry: {
              type: 'Point',
              coordinates: [10.73353, 59.91187]
            }
          },
          stedsnavn: [
            {
              navnestatus: 'hovednavn',
              skrivemåte: 'Oslo fylke',
              skrivemåtestatus: 'godkjent og prioritert',
              språk: 'Norsk',
              stedsnavnnummer: 1
            },
            {
              navnestatus: 'hovednavn',
              skrivemåte: 'Oslo',
              skrivemåtestatus: 'foreslått',
              språk: 'Norsk',
              stedsnavnnummer: 1
            }
          ],
          fylker: [{ fylkesnavn: 'Oslo', fylkesnummer: '03' }],
          kommuner: [{ kommunenavn: 'Oslo', kommunenummer: '0301' }]
        }
      ]
    };

    nock(GEONORGE_URL)
      .get('/stedsnavn/v1/sted')
      .query(true)
      .reply(200, mockResponse);

    const result = await geocode('Oslo');

    assert.equal(result.lat, 59.91187);
    assert.equal(result.lon, 10.73353);
    assert.equal(result.placeName, 'Oslo');
  });

  it('throws when location not found (empty navn array)', async () => {
    nock(GEONORGE_URL)
      .get('/stedsnavn/v1/sted')
      .query(true)
      .reply(200, { metadata: {}, navn: [] });

    try {
      await geocode('NonexistentPlace12345');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('Location not found'));
      assert.equal(err.code, 'LOCATION_NOT_FOUND');
    }
  });

  it('throws on API error (404)', async () => {
    nock(GEONORGE_URL)
      .get('/stedsnavn/v1/sted')
      .query(true)
      .reply(404, { error: 'Not found' });

    try {
      await geocode('Oslo');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('Request failed'));
    }
  });

  it('uses the shorter skrivemåte as placeName when multiple entries exist', async () => {
    const mockResponse = {
      metadata: {},
      navn: [
        {
          stedsnummer: 123,
          geojson: {
            geometry: { type: 'Point', coordinates: [5.32, 60.39] }
          },
          stedsnavn: [
            { skrivemåte: 'Bergen kommune' },
            { skrivemåte: 'Bergen' },
            { skrivemåte: 'B' }
          ]
        }
      ]
    };

    nock(GEONORGE_URL)
      .get('/stedsnavn/v1/sted')
      .query(true)
      .reply(200, mockResponse);

    const result = await geocode('Bergen');
    assert.equal(result.placeName, 'B');
  });

  it('uses first skrivemåte when only one entry exists', async () => {
    const mockResponse = {
      metadata: {},
      navn: [
        {
          stedsnummer: 456,
          geojson: {
            geometry: { type: 'Point', coordinates: [11.0, 60.0] }
          },
          stedsnavn: [
            { skrivemåte: 'Trondheim' }
          ]
        }
      ]
    };

    nock(GEONORGE_URL)
      .get('/stedsnavn/v1/sted')
      .query(true)
      .reply(200, mockResponse);

    const result = await geocode('Trondheim');
    assert.equal(result.placeName, 'Trondheim');
  });
});
