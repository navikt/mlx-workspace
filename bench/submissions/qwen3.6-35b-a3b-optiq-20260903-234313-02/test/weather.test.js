import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import { fetchWeather } from '../src/weather.js';

describe('fetchWeather', () => {
  const MET_NO_URL = 'https://api.met.no';

  beforeEach(() => {
    nock.cleanAll();
  });

  it('returns weather data with all required fields', async () => {
    const now = new Date();
    const mockTime = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    const mockResponse = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.75, 59.91, 20] },
      properties: {
        meta: {
          updated_at: now.toISOString(),
          units: {
            air_temperature: 'degC',
            relative_humidity: '%',
            wind_speed: 'm/s',
            air_pressure_at_sea_level: 'hPa',
            ultraviolet_index_clear_sky: '1'
          }
        },
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
              next_1_hours: {
                summary: { symbol_code: 'cloudy' },
                details: { precipitation_amount: 0.5 }
              },
              next_6_hours: {
                summary: { symbol_code: 'lightrain' },
                details: {
                  air_temperature_max: 7,
                  air_temperature_min: 4,
                  precipitation_amount: 2.1
                }
              },
              next_12_hours: {
                summary: { symbol_code: 'rain', symbol_confidence: 'certain' },
                details: { probability_of_precipitation: 80 }
              }
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

    nock(MET_NO_URL)
      .get('/weatherapi/locationforecast/2.0/complete')
      .query(true)
      .reply(200, mockResponse);

    const result = await fetchWeather(59.91, 10.75);

    assert.equal(result.temperature, 6.1);
    assert.equal(result.humidity, 72);
    assert.equal(result.windSpeed, 4.2);
    assert.equal(result.pressure, 1012.8);
    assert.equal(result.uvIndex, 1.2);
    assert.equal(result.description, 'Partly cloudy');
  });

  it('derives "Overcast" when cloud_area_fraction > 75', async () => {
    const now = new Date();
    const mockResponse = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.75, 59.91] },
      properties: {
        meta: { updated_at: now.toISOString(), units: {} },
        timeseries: [
          {
            time: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 5,
                  relative_humidity: 80,
                  wind_speed: 2,
                  air_pressure_at_sea_level: 1010,
                  ultraviolet_index_clear_sky: 0.1,
                  cloud_area_fraction: 85
                }
              }
            }
          }
        ]
      }
    };

    nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .query(true)
      .reply(200, mockResponse);

    const result = await fetchWeather(59.91, 10.75);
    assert.equal(result.description, 'Overcast');
  });

  it('derives "Mostly clear" when cloud_area_fraction > 25 and <= 50', async () => {
    const now = new Date();
    const mockResponse = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.75, 59.91] },
      properties: {
        meta: { updated_at: now.toISOString(), units: {} },
        timeseries: [
          {
            time: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 5,
                  relative_humidity: 80,
                  wind_speed: 2,
                  air_pressure_at_sea_level: 1010,
                  ultraviolet_index_clear_sky: 0.1,
                  cloud_area_fraction: 30
                }
              }
            }
          }
        ]
      }
    };

    nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .query(true)
      .reply(200, mockResponse);

    const result = await fetchWeather(59.91, 10.75);
    assert.equal(result.description, 'Mostly clear');
  });

  it('derives "Clear" when cloud_area_fraction <= 25', async () => {
    const now = new Date();
    const mockResponse = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.75, 59.91] },
      properties: {
        meta: { updated_at: now.toISOString(), units: {} },
        timeseries: [
          {
            time: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 5,
                  relative_humidity: 80,
                  wind_speed: 2,
                  air_pressure_at_sea_level: 1010,
                  ultraviolet_index_clear_sky: 0.1,
                  cloud_area_fraction: 10
                }
              }
            }
          }
        ]
      }
    };

    nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .query(true)
      .reply(200, mockResponse);

    const result = await fetchWeather(59.91, 10.75);
    assert.equal(result.description, 'Clear');
  });

  it('throws when timeseries is empty', async () => {
    const now = new Date();
    const mockResponse = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.75, 59.91] },
      properties: {
        meta: { updated_at: now.toISOString(), units: {} },
        timeseries: []
      }
    };

    nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .query(true)
      .reply(200, mockResponse);

    try {
      await fetchWeather(59.91, 10.75);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.equal(err.code, 'NO_DATA');
    }
  });

  it('throws when API returns 403', async () => {
    nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .query(true)
      .reply(403, { error: 'Forbidden - bad user agent' });

    try {
      await fetchWeather(59.91, 10.75);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('Request failed'));
    }
  });

  it('throws when instant.details is missing', async () => {
    const now = new Date();
    const mockResponse = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10.75, 59.91] },
      properties: {
        meta: { updated_at: now.toISOString(), units: {} },
        timeseries: [
          {
            time: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
            data: {
              instant: {}
            }
          }
        ]
      }
    };

    nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .query(true)
      .reply(200, mockResponse);

    try {
      await fetchWeather(59.91, 10.75);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.equal(err.code, 'INVALID_DATA');
    }
  });
});
