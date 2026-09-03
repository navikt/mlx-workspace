import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { fetchWeather, findClosestEntry, extractData } from '../weather.js';

describe('weather API', () => {
  it('fetches weather data from Met.no', async () => {
    const mockResponse = {
      properties: {
        meta: {
          updated_at: '2026-09-03T07:31:58Z',
          units: { air_temperature: 'celsius' },
        },
        timeseries: [
          {
            time: '2026-09-03T08:00:00Z',
            data: {
              instant: {
                details: {
                  air_temperature: 14,
                  relative_humidity: 54.9,
                  wind_speed: 2.2,
                  air_pressure_at_sea_level: 1006.9,
                  ultraviolet_index_clear_sky: 1.5,
                  cloud_area_fraction: 13.6,
                },
              },
            },
          },
        ],
      },
    };

    mock.method(axios, 'get', () => Promise.resolve({ data: mockResponse }));

    const result = await fetchWeather(59.91, 10.75);

    assert.strictEqual(result.properties.timeseries.length, 1);
    assert.strictEqual(result.properties.timeseries[0].data.instant.details.air_temperature, 14);
  });

  it('throws on 403 response', async () => {
    mock.method(axios, 'get', () =>
      Promise.reject({ response: { status: 403, statusText: 'Forbidden' } })
    );

    try {
      await fetchWeather(59.91, 10.75);
      assert.fail('Should have thrown');
    } catch (error) {
      assert.ok(error.message.includes('403'));
    }
  });

  it('throws on 429 response', async () => {
    mock.method(axios, 'get', () =>
      Promise.reject({ response: { status: 429, statusText: 'Too Many Requests' } })
    );

    try {
      await fetchWeather(59.91, 10.75);
      assert.fail('Should have thrown');
    } catch (error) {
      assert.ok(error.message.includes('429'));
    }
  });

  describe('findClosestEntry', () => {
    it('finds the entry closest to current time in UTC', () => {
      const now = new Date();
      const timeseries = [
        { time: new Date(now.getTime() - 3600000).toISOString() },
        { time: new Date(now.getTime() - 1800000).toISOString() },
        { time: new Date(now.getTime() + 1800000).toISOString() },
        { time: new Date(now.getTime() + 3600000).toISOString() },
      ];

      const closest = findClosestEntry(timeseries);

      // The closest should be one of the two middle entries (1.5 hours away)
      const closestDiff = Math.abs(new Date(closest.time).getTime() - now.getTime());
      assert.ok(closestDiff <= 1800000 + 60000); // Allow 1 minute tolerance for execution time
    });

    it('throws on empty timeseries', () => {
      try {
        findClosestEntry([]);
        assert.fail('Should have thrown');
      } catch (error) {
        assert.ok(error.message.includes('No weather data'));
      }
    });

    it('throws on undefined timeseries', () => {
      try {
        findClosestEntry(undefined);
        assert.fail('Should have thrown');
      } catch (error) {
        assert.ok(error.message.includes('No weather data'));
      }
    });
  });

  describe('extractData', () => {
    it('extracts all fields from a complete entry', () => {
      const entry = {
        data: {
          instant: {
            details: {
              air_temperature: 14,
              relative_humidity: 54.9,
              wind_speed: 2.2,
              air_pressure_at_sea_level: 1006.9,
              ultraviolet_index_clear_sky: 1.5,
              cloud_area_fraction: 13.6,
            },
          },
        },
      };

      const data = extractData(entry);

      assert.strictEqual(data.temperature, 14);
      assert.strictEqual(data.humidity, 54.9);
      assert.strictEqual(data.windSpeed, 2.2);
      assert.strictEqual(data.pressure, 1006.9);
      assert.strictEqual(data.uvIndex, 1.5);
      assert.strictEqual(data.description, 'Clear');
    });

    it('derives description from cloud_area_fraction > 75', () => {
      const entry = {
        data: {
          instant: {
            details: {
              air_temperature: 10,
              relative_humidity: 80,
              wind_speed: 3,
              air_pressure_at_sea_level: 1000,
              ultraviolet_index_clear_sky: 0.5,
              cloud_area_fraction: 80,
            },
          },
        },
      };

      const data = extractData(entry);

      assert.strictEqual(data.description, 'Overcast');
    });

    it('derives description from cloud_area_fraction > 50', () => {
      const entry = {
        data: {
          instant: {
            details: {
              air_temperature: 10,
              relative_humidity: 70,
              wind_speed: 2,
              air_pressure_at_sea_level: 1005,
              ultraviolet_index_clear_sky: 1,
              cloud_area_fraction: 60,
            },
          },
        },
      };

      const data = extractData(entry);

      assert.strictEqual(data.description, 'Partly cloudy');
    });

    it('derives description from cloud_area_fraction > 25', () => {
      const entry = {
        data: {
          instant: {
            details: {
              air_temperature: 15,
              relative_humidity: 60,
              wind_speed: 1.5,
              air_pressure_at_sea_level: 1010,
              ultraviolet_index_clear_sky: 2,
              cloud_area_fraction: 30,
            },
          },
        },
      };

      const data = extractData(entry);

      assert.strictEqual(data.description, 'Mostly clear');
    });

    it('derives description from cloud_area_fraction <= 25', () => {
      const entry = {
        data: {
          instant: {
            details: {
              air_temperature: 20,
              relative_humidity: 40,
              wind_speed: 1,
              air_pressure_at_sea_level: 1015,
              ultraviolet_index_clear_sky: 3,
              cloud_area_fraction: 10,
            },
          },
        },
      };

      const data = extractData(entry);

      assert.strictEqual(data.description, 'Clear');
    });

    it('trap #2: cloud_area_fraction exactly 75 is NOT overcast', () => {
      const entry = {
        data: {
          instant: {
            details: {
              air_temperature: 10,
              relative_humidity: 80,
              wind_speed: 3,
              air_pressure_at_sea_level: 1000,
              ultraviolet_index_clear_sky: 0.5,
              cloud_area_fraction: 75,
            },
          },
        },
      };

      const data = extractData(entry);

      // 75 is NOT > 75, so it falls through to > 50 → Partly cloudy
      assert.strictEqual(data.description, 'Partly cloudy');
    });

    it('trap #2: cloud_area_fraction exactly 50 is NOT partly cloudy', () => {
      const entry = {
        data: {
          instant: {
            details: {
              air_temperature: 10,
              relative_humidity: 70,
              wind_speed: 2,
              air_pressure_at_sea_level: 1005,
              ultraviolet_index_clear_sky: 1,
              cloud_area_fraction: 50,
            },
          },
        },
      };

      const data = extractData(entry);

      // 50 is NOT > 50, so it falls through to > 25 → Mostly clear
      assert.strictEqual(data.description, 'Mostly clear');
    });

    it('trap #2: cloud_area_fraction exactly 25 is NOT mostly clear', () => {
      const entry = {
        data: {
          instant: {
            details: {
              air_temperature: 15,
              relative_humidity: 60,
              wind_speed: 1.5,
              air_pressure_at_sea_level: 1010,
              ultraviolet_index_clear_sky: 2,
              cloud_area_fraction: 25,
            },
          },
        },
      };

      const data = extractData(entry);

      // 25 is NOT > 25, so it falls through to else → Clear
      assert.strictEqual(data.description, 'Clear');
    });

    it('trap #4: handles missing ultraviolet_index_clear_sky', () => {
      const entry = {
        data: {
          instant: {
            details: {
              air_temperature: 10,
              relative_humidity: 80,
              wind_speed: 3,
              air_pressure_at_sea_level: 1000,
              cloud_area_fraction: 20,
              // ultraviolet_index_clear_sky is missing
            },
          },
        },
      };

      const data = extractData(entry);

      assert.strictEqual(data.uvIndex, undefined);
      assert.strictEqual(data.description, 'Clear');
    });

    it('trap #5: handles missing cloud_area_fraction', () => {
      const entry = {
        data: {
          instant: {
            details: {
              air_temperature: 10,
              relative_humidity: 80,
              wind_speed: 3,
              air_pressure_at_sea_level: 1000,
              ultraviolet_index_clear_sky: 1,
              // cloud_area_fraction is missing
            },
          },
        },
      };

      const data = extractData(entry);

      assert.strictEqual(data.description, undefined);
      assert.strictEqual(data.uvIndex, 1);
    });
  });
});
