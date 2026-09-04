import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { geocode } from './geocode.js';
import axios from 'axios';
import fs from 'fs';

const realResponse = JSON.parse(fs.readFileSync('/tmp/geonorge_response.json', 'utf8'));

describe('geocode', () => {
  it('should return lat, lon, and displayName for a valid location', async () => {
    const axiosGetStub = axios.get;
    const mockResponse = {
      data: {
        navn: [{
          stedsnavn: [
            { språk: 'Norsk', navnestatus: 'hovednavn', skrivemåte: 'Oslo fylke' },
            { språk: 'Norsk', navnestatus: 'hovednavn', skrivemåte: 'Oslo' }
          ],
          geojson: { geometry: { coordinates: [10.73353, 59.91187] } }
        }]
      }
    };

    let calledUrl, calledParams, calledHeaders;
    axios.get = async (url, config) => {
      calledUrl = url;
      calledParams = config.params;
      calledHeaders = config.headers;
      return mockResponse;
    };

    try {
      const result = await geocode('Oslo');

      assert.equal(calledUrl, 'https://ws.geonorge.no/stedsnavn/v1/sted');
      assert.equal(calledParams.sok, 'Oslo');
      assert.equal(calledParams.fuzzy, true);
      assert.equal(calledParams.treffPerSide, 1);
      assert.equal(calledParams.utkoordsys, 4258);
      assert.equal(calledHeaders['User-Agent'], 'weather-cli/1.0 github.com/weather-cli');
      assert.equal(calledHeaders['Accept'], 'application/json');

      assert.equal(result.lat, 59.91187);
      assert.equal(result.lon, 10.73353);
      assert.equal(result.displayName, 'Oslo fylke');
    } finally {
      axios.get = axiosGetStub;
    }
  });

  it('should throw when no results are returned', async () => {
    const axiosGetStub = axios.get;
    const mockResponse = { data: { navn: [] } };

    axios.get = async () => mockResponse;

    try {
      await assert.rejects(geocode('NonexistentPlace12345'), Error);
    } finally {
      axios.get = axiosGetStub;
    }
  });

  it('should fallback to first stedsnavn when no Norsk hovednavn found', async () => {
    const axiosGetStub = axios.get;
    const mockResponse = {
      data: {
        navn: [{
          stedsnavn: [
            { språk: 'English', navnestatus: 'hovednavn', skrivemåte: 'London' }
          ],
          geojson: { geometry: { coordinates: [-0.1276, 51.5074] } }
        }]
      }
    };

    axios.get = async () => mockResponse;

    try {
      const result = await geocode('London');
      assert.equal(result.displayName, 'London');
      assert.equal(result.lat, 51.5074);
      assert.equal(result.lon, -0.1276);
    } finally {
      axios.get = axiosGetStub;
    }
  });

  it('should throw on API error', async () => {
    const axiosGetStub = axios.get;
    const error = new Error('Network Error');
    error.response = { status: 500, statusText: 'Internal Server Error' };

    axios.get = async () => { throw error; };

    try {
      await assert.rejects(geocode('Oslo'), /Geonorge API error: 500/);
    } finally {
      axios.get = axiosGetStub;
    }
  });
});
