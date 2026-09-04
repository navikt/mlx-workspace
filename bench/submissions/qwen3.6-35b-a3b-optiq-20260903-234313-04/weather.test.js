import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWeather } from './weather.js';
import axios from 'axios';

describe('fetchWeather', () => {
  it('should return weather data for valid coordinates', async () => {
    const now = new Date('2026-09-03T22:30:00Z');

    const mockResponse = {
      data: {
        properties: {
          timeseries: [
            {
              time: '2026-09-03T22:00:00Z',
              data: {
                instant: {
                  details: {
                    air_temperature: 14.8,
                    cloud_area_fraction: 100,
                    relative_humidity: 69.7,
                    wind_speed: 2.5,
                    air_pressure_at_sea_level: 1003,
                    ultraviolet_index_clear_sky: 0
                  }
                }
              }
            },
            {
              time: '2026-09-03T23:00:00Z',
              data: {
                instant: {
                  details: {
                    air_temperature: 14.0,
                    cloud_area_fraction: 95,
                    relative_humidity: 72.0,
                    wind_speed: 2.1,
                    air_pressure_at_sea_level: 1004,
                    ultraviolet_index_clear_sky: 0
                  }
                }
              }
            }
          ]
        }
      }
    };

    const axiosGetStub = axios.get;
    let calledUrl, calledParams, calledHeaders;

    axios.get = async (url, config) => {
      calledUrl = url;
      calledParams = config.params;
      calledHeaders = config.headers;
      return mockResponse;
    };

    try {
      const result = await fetchWeather(59.91, 10.75, now);

      assert.equal(calledUrl, 'https://api.met.no/weatherapi/locationforecast/2.0/complete');
      assert.equal(calledParams.lat, 59.91);
      assert.equal(calledParams.lon, 10.75);
      assert.equal(calledHeaders['User-Agent'], 'weather-cli/1.0 github.com/weather-cli');

      assert.equal(result.temperature, 14.8);
      assert.equal(result.description, 'Overcast');
      assert.equal(result.humidity, 69.7);
      assert.equal(result.windSpeed, 2.5);
      assert.equal(result.pressure, 1003);
      assert.equal(result.uvIndex, 0);
    } finally {
      axios.get = axiosGetStub;
    }
  });

  it('should select closest timeseries entry to current time', async () => {
    const now = new Date('2026-09-03T22:15:00Z');

    const mockResponse = {
      data: {
        properties: {
          timeseries: [
            {
              time: '2026-09-03T22:00:00Z',
              data: { instant: { details: { air_temperature: 14.0, cloud_area_fraction: 50, relative_humidity: 70, wind_speed: 2.0, air_pressure_at_sea_level: 1000, ultraviolet_index_clear_sky: 1 } } }
            },
            {
              time: '2026-09-03T23:00:00Z',
              data: { instant: { details: { air_temperature: 13.0, cloud_area_fraction: 80, relative_humidity: 75, wind_speed: 1.5, air_pressure_at_sea_level: 1001, ultraviolet_index_clear_sky: 0 } } }
            }
          ]
        }
      }
    };

    const axiosGetStub = axios.get;
    axios.get = async () => mockResponse;

    try {
      const result = await fetchWeather(59.91, 10.75, now);
      assert.equal(result.temperature, 14.0, 'Should pick 22:00 entry (15min away) over 23:00 (45min away)');
    } finally {
      axios.get = axiosGetStub;
    }
  });

  it('should derive "Overcast" for cloud_area_fraction > 75', async () => {
    const mockResponse = {
      data: {
        properties: {
          timeseries: [{
            time: '2026-09-03T22:00:00Z',
            data: { instant: { details: { air_temperature: 10, cloud_area_fraction: 80, relative_humidity: 60, wind_speed: 1, air_pressure_at_sea_level: 1000, ultraviolet_index_clear_sky: 1 } } }
          }]
        }
      }
    };

    const axiosGetStub = axios.get;
    axios.get = async () => mockResponse;

    try {
      const result = await fetchWeather(59.91, 10.75);
      assert.equal(result.description, 'Overcast');
    } finally {
      axios.get = axiosGetStub;
    }
  });

  it('should derive "Partly cloudy" for cloud_area_fraction > 50', async () => {
    const mockResponse = {
      data: {
        properties: {
          timeseries: [{
            time: '2026-09-03T22:00:00Z',
            data: { instant: { details: { air_temperature: 10, cloud_area_fraction: 60, relative_humidity: 60, wind_speed: 1, air_pressure_at_sea_level: 1000, ultraviolet_index_clear_sky: 1 } } }
          }]
        }
      }
    };

    const axiosGetStub = axios.get;
    axios.get = async () => mockResponse;

    try {
      const result = await fetchWeather(59.91, 10.75);
      assert.equal(result.description, 'Partly cloudy');
    } finally {
      axios.get = axiosGetStub;
    }
  });

  it('should derive "Mostly clear" for cloud_area_fraction > 25', async () => {
    const mockResponse = {
      data: {
        properties: {
          timeseries: [{
            time: '2026-09-03T22:00:00Z',
            data: { instant: { details: { air_temperature: 10, cloud_area_fraction: 30, relative_humidity: 60, wind_speed: 1, air_pressure_at_sea_level: 1000, ultraviolet_index_clear_sky: 1 } } }
          }]
        }
      }
    };

    const axiosGetStub = axios.get;
    axios.get = async () => mockResponse;

    try {
      const result = await fetchWeather(59.91, 10.75);
      assert.equal(result.description, 'Mostly clear');
    } finally {
      axios.get = axiosGetStub;
    }
  });

  it('should derive "Clear" for cloud_area_fraction <= 25', async () => {
    const mockResponse = {
      data: {
        properties: {
          timeseries: [{
            time: '2026-09-03T22:00:00Z',
            data: { instant: { details: { air_temperature: 10, cloud_area_fraction: 10, relative_humidity: 60, wind_speed: 1, air_pressure_at_sea_level: 1000, ultraviolet_index_clear_sky: 1 } } }
          }]
        }
      }
    };

    const axiosGetStub = axios.get;
    axios.get = async () => mockResponse;

    try {
      const result = await fetchWeather(59.91, 10.75);
      assert.equal(result.description, 'Clear');
    } finally {
      axios.get = axiosGetStub;
    }
  });

  it('should throw on empty timeseries', async () => {
    const mockResponse = { data: { properties: { timeseries: [] } } };

    const axiosGetStub = axios.get;
    axios.get = async () => mockResponse;

    try {
      await assert.rejects(fetchWeather(59.91, 10.75), /No weather data/);
    } finally {
      axios.get = axiosGetStub;
    }
  });

  it('should throw on 403 error', async () => {
    const error = new Error('Forbidden');
    error.response = { status: 403, statusText: 'Forbidden' };

    const axiosGetStub = axios.get;
    axios.get = async () => { throw error; };

    try {
      await assert.rejects(fetchWeather(59.91, 10.75), /403/);
    } finally {
      axios.get = axiosGetStub;
    }
  });

  it('should throw on 429 error', async () => {
    const error = new Error('Too Many Requests');
    error.response = { status: 429, statusText: 'Too Many Requests' };

    const axiosGetStub = axios.get;
    axios.get = async () => { throw error; };

    try {
      await assert.rejects(fetchWeather(59.91, 10.75), /429/);
    } finally {
      axios.get = axiosGetStub;
    }
  });
});
