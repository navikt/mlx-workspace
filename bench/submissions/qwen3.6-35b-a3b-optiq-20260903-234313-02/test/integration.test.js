import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import { parseLocation } from '../src/parser.js';
import { geocode } from '../src/geocode.js';
import { fetchWeather } from '../src/weather.js';
import { formatWeather } from '../src/output.js';

describe('integration', () => {
  const GEONORGE_URL = 'https://ws.geonorge.no';
  const MET_NO_URL = 'https://api.met.no';

  beforeEach(() => {
    nock.cleanAll();
  });

  it('full flow: place name → geocode → weather → output', async () => {
    const now = new Date();
    const mockTime = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    const geonorgeResponse = {
      metadata: { side: 1, totaltAntallTreff: 1, treffPerSide: 1, viserFra: 1, viserTil: 1 },
      navn: [
        {
          stedsnummer: 509924,
          geojson: { geometry: { type: 'Point', coordinates: [10.73353, 59.91187] } },
          stedsnavn: [{ skrivemåte: 'Oslo' }],
          fylker: [],
          kommuner: []
        }
      ]
    };

    const metNoResponse = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.75, 59.91, 20] },
      properties: {
        meta: { updated_at: now.toISOString(), units: {} },
        timeseries: [
          {
            time: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 5.2,
                  relative_humidity: 78,
                  wind_speed: 3.5,
                  air_pressure_at_sea_level: 1013.2,
                  ultraviolet_index_clear_sky: 0.5,
                  cloud_area_fraction: 20
                }
              }
            }
          },
          {
            time: mockTime,
            data: {
              instant: {
                details: {
                  air_temperature: 6.1,
                  relative_humidity: 72,
                  wind_speed: 4.2,
                  air_pressure_at_sea_level: 1012.8,
                  ultraviolet_index_clear_sky: 1.2,
                  cloud_area_fraction: 60
                }
              },
              next_1_hours: { summary: { symbol_code: 'cloudy' }, details: { precipitation_amount: 0.5 } },
              next_6_hours: { summary: { symbol_code: 'lightrain' }, details: { air_temperature_max: 7, air_temperature_min: 4, precipitation_amount: 2.1 } },
              next_12_hours: { summary: { symbol_code: 'rain', symbol_confidence: 'certain' }, details: { probability_of_precipitation: 80 } }
            }
          },
          {
            time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 5.8,
                  relative_humidity: 75,
                  wind_speed: 3.8,
                  air_pressure_at_sea_level: 1013.0,
                  ultraviolet_index_clear_sky: 0.3,
                  cloud_area_fraction: 40
                }
              }
            }
          }
        ]
      }
    };

    nock(GEONORGE_URL)
      .get('/stedsnavn/v1/sted')
      .query({ sok: 'Oslo', fuzzy: true, treffPerSide: '1', utkoordsys: '4258' })
      .reply(200, geonorgeResponse);

    nock(MET_NO_URL)
      .get('/weatherapi/locationforecast/2.0/complete')
      .query({ lat: '59.91187', lon: '10.73353' })
      .reply(200, metNoResponse);

    const location = parseLocation(['Oslo']);
    assert.equal(location.type, 'name');

    const geo = await geocode(location.name);
    assert.equal(geo.placeName, 'Oslo');
    assert.equal(geo.lat, 59.91187);
    assert.equal(geo.lon, 10.73353);

    const weather = await fetchWeather(geo.lat, geo.lon);
    assert.equal(weather.temperature, 6.1);
    assert.equal(weather.description, 'Partly cloudy');
    assert.equal(weather.humidity, 72);
    assert.equal(weather.windSpeed, 4.2);
    assert.equal(weather.pressure, 1012.8);
    assert.equal(weather.uvIndex, 1.2);

    const output = formatWeather(geo.placeName, weather);
    const lines = output.split('\n');
    assert.equal(lines.length, 7);
    assert.ok(lines[0].includes('Oslo'));
    assert.ok(lines[0].includes('Met.no API'));
    assert.ok(lines[1].includes('6.1'));
    assert.ok(lines[2].includes('Partly cloudy'));
    assert.ok(lines[3].includes('72'));
    assert.ok(lines[4].includes('4.2'));
    assert.ok(lines[5].includes('1012.8'));
    assert.ok(lines[6].includes('1.2'));
  });

  it('full flow: coordinates → weather → output (no geocode)', async () => {
    const now = new Date();
    const mockTime = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    const metNoResponse = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.75, 59.91, 20] },
      properties: {
        meta: { updated_at: now.toISOString(), units: {} },
        timeseries: [
          {
            time: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 7.0,
                  relative_humidity: 70,
                  wind_speed: 4.0,
                  air_pressure_at_sea_level: 1010.0,
                  ultraviolet_index_clear_sky: 0.5,
                  cloud_area_fraction: 30
                }
              }
            }
          },
          {
            time: mockTime,
            data: {
              instant: {
                details: {
                  air_temperature: 8.5,
                  relative_humidity: 65,
                  wind_speed: 5.1,
                  air_pressure_at_sea_level: 1008.3,
                  ultraviolet_index_clear_sky: 0.8,
                  cloud_area_fraction: 15
                }
              },
              next_1_hours: { summary: { symbol_code: 'clear' }, details: { precipitation_amount: 0 } },
              next_6_hours: { summary: { symbol_code: 'clear' }, details: { air_temperature_max: 9, air_temperature_min: 6, precipitation_amount: 0 } },
              next_12_hours: { summary: { symbol_code: 'fair', symbol_confidence: 'certain' }, details: { probability_of_precipitation: 5 } }
            }
          },
          {
            time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 8.0,
                  relative_humidity: 67,
                  wind_speed: 4.8,
                  air_pressure_at_sea_level: 1008.5,
                  ultraviolet_index_clear_sky: 0.2,
                  cloud_area_fraction: 20
                }
              }
            }
          }
        ]
      }
    };

    nock(MET_NO_URL)
      .get('/weatherapi/locationforecast/2.0/complete')
      .query({ lat: '59.91', lon: '10.75' })
      .reply(200, metNoResponse);

    const location = parseLocation(['59.91 10.75']);
    assert.equal(location.type, 'coordinates');
    assert.equal(location.lat, 59.91);
    assert.equal(location.lon, 10.75);

    const weather = await fetchWeather(location.lat, location.lon);
    assert.equal(weather.temperature, 8.5);
    assert.equal(weather.description, 'Clear');
    assert.equal(weather.humidity, 65);
    assert.equal(weather.windSpeed, 5.1);
    assert.equal(weather.pressure, 1008.3);
    assert.equal(weather.uvIndex, 0.8);

    const output = formatWeather(`${location.lat} ${location.lon}`, weather);
    const lines = output.split('\n');
    assert.equal(lines.length, 7);
    assert.ok(lines[0].includes('59.91 10.75'));
    assert.ok(lines[1].includes('8.5'));
    assert.ok(lines[2].includes('Clear'));
    assert.ok(lines[3].includes('65'));
    assert.ok(lines[4].includes('5.1'));
    assert.ok(lines[5].includes('1008.3'));
    assert.ok(lines[6].includes('0.8'));
  });

  it('exits with code 1 when no arguments provided', () => {
    const location = parseLocation([]);
    assert.equal(location, null);
  });

  it('exits with code 1 when geocoding fails', async () => {
    nock(GEONORGE_URL)
      .get('/stedsnavn/v1/sted')
      .query(true)
      .reply(200, { metadata: {}, navn: [] });

    try {
      await geocode('NonexistentPlaceXYZ123');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('Location not found'));
    }
  });
});
