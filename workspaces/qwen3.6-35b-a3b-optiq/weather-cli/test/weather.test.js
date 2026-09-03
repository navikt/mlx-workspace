import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWeather, findClosestTimeseries, getDescription } from '../weather.js';
import axios from 'axios';

// Mock axios for weather tests
const originalGet = axios.get;

describe('weather', () => {
  let mockAxiosGet;

  before(() => {
    axios.get = async (url, config) => {
      return mockAxiosGet(url, config);
    };
  });

  after(() => {
    axios.get = originalGet;
  });

  describe('getDescription', () => {
    it('should return Overcast for cloud cover >= 75', () => {
      assert.equal(getDescription({ cloud_area_fraction: 75 }), 'Overcast');
      assert.equal(getDescription({ cloud_area_fraction: 76 }), 'Overcast');
      assert.equal(getDescription({ cloud_area_fraction: 100 }), 'Overcast');
    });

    it('should return Partly cloudy for cloud cover > 50 and < 75', () => {
      assert.equal(getDescription({ cloud_area_fraction: 51 }), 'Partly cloudy');
      assert.equal(getDescription({ cloud_area_fraction: 74 }), 'Partly cloudy');
    });

    it('should return Mostly clear for cloud cover > 25 and <= 50', () => {
      assert.equal(getDescription({ cloud_area_fraction: 26 }), 'Mostly clear');
      assert.equal(getDescription({ cloud_area_fraction: 50 }), 'Mostly clear');
    });

    it('should return Clear for cloud cover <= 25', () => {
      assert.equal(getDescription({ cloud_area_fraction: 0 }), 'Clear');
      assert.equal(getDescription({ cloud_area_fraction: 25 }), 'Clear');
    });

    it('should return Unknown when cloud_area_fraction is missing', () => {
      assert.equal(getDescription({}), 'Unknown');
      assert.equal(getDescription(null), 'Unknown');
      assert.equal(getDescription(undefined), 'Unknown');
    });
  });

  describe('findClosestTimeseries', () => {
    it('should find the closest entry to current time (UTC)', () => {
      const now = new Date();
      const nowUTC = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      );

      // Create entries: one 1 hour before, one 30 min before, one 15 min before
      const t1 = new Date(nowUTC - 3600000).toISOString();
      const t2 = new Date(nowUTC - 1800000).toISOString();
      const t3 = new Date(nowUTC - 900000).toISOString();

      const weatherData = {
        properties: {
          timeseries: [
            { time: t1, instant: { details: { temperature: 10 } } },
            { time: t2, instant: { details: { temperature: 11 } } },
            { time: t3, instant: { details: { temperature: 12 } } },
          ],
        },
      };

      const closest = findClosestTimeseries(weatherData);
      assert.equal(closest.instant.details.temperature, 12);
    });

    it('should throw when no timeseries exists', () => {
      assert.throws(
        () => findClosestTimeseries({}),
        /no timeseries/
      );
    });

    it('should throw when timeseries is empty', () => {
      assert.throws(
        () => findClosestTimeseries({ properties: { timeseries: [] } }),
        /No timeseries entries/
      );
    });
  });

  describe('fetchWeather', () => {
    it('should fetch weather data from Met.no API', async () => {
      const now = new Date();
      const nowUTC = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      );
      const timeStr = new Date(nowUTC).toISOString();

      mockAxiosGet = async (url, config) => {
        assert.ok(url.includes('api.met.no'), 'Should call Met.no API');
        assert.ok(config.params.lat, 'Should pass latitude');
        assert.ok(config.params.lon, 'Should pass longitude');
        assert.equal(config.headers['User-Agent'], 'weather-cli/1.0 github.com/weather-cli', 'Should include User-Agent');

        return {
          data: {
            properties: {
              timeseries: [
                {
                  time: timeStr,
                  instant: {
                    details: {
                      temperature: 15.2,
                      relative_humidity: 68,
                      wind_speed: 3.5,
                      air_pressure_at_sea_level: 1013.2,
                      ultraviolet_index_clear_sky: 4.1,
                      cloud_area_fraction: 50,
                    },
                  },
                },
              ],
            },
          },
        };
      };

      const weatherData = await fetchWeather(59.91, 10.75);
      assert.ok(weatherData.properties, 'Should have properties');
      assert.ok(weatherData.properties.timeseries, 'Should have timeseries');
      assert.equal(weatherData.properties.timeseries.length, 1, 'Should have 1 timeseries entry');
    });

    it('should throw on Met.no API error', async () => {
      mockAxiosGet = async () => {
        const error = new Error('Network Error');
        error.response = { status: 403, statusText: 'Forbidden' };
        throw error;
      };

      try {
        await fetchWeather(59.91, 10.75);
        assert.fail('Should have thrown');
      } catch (error) {
        assert.ok(error.message.includes('Met.no API error'), 'Should mention Met.no API error');
      }
    });

    it('should handle missing UV index gracefully', () => {
      const now = new Date();
      const nowUTC = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      );
      const timeStr = new Date(nowUTC).toISOString();

      const weatherData = {
        properties: {
          timeseries: [
            {
              time: timeStr,
              instant: {
                details: {
                  temperature: 15,
                  relative_humidity: 68,
                  wind_speed: 3.5,
                  air_pressure_at_sea_level: 1013,
                  // No ultraviolet_index_clear_sky
                  cloud_area_fraction: 20,
                },
              },
            },
          ],
        },
      };

      const closest = findClosestTimeseries(weatherData);
      const details = closest.instant.details;

      // UV index should be undefined/null when missing
      assert.equal(details.ultraviolet_index_clear_sky, undefined);
    });

    it('should handle missing cloud fraction gracefully', () => {
      const now = new Date();
      const nowUTC = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      );
      const timeStr = new Date(nowUTC).toISOString();

      const weatherData = {
        properties: {
          timeseries: [
            {
              time: timeStr,
              instant: {
                details: {
                  temperature: 15,
                  relative_humidity: 68,
                  wind_speed: 3.5,
                  air_pressure_at_sea_level: 1013,
                  ultraviolet_index_clear_sky: 4,
                  // No cloud_area_fraction
                },
              },
            },
          ],
        },
      };

      const closest = findClosestTimeseries(weatherData);
      // This should return 'Unknown' not 'Clear'
      assert.equal(getDescription(closest.instant.details), 'Unknown');
    });
  });
});
