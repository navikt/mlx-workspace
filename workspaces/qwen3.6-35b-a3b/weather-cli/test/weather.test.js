import { describe, it } from 'node:test';
import assert from 'node:assert';
import nock from 'nock';
import { fetchWeather } from '../weather.js';

describe('weather.test.js', () => {
  const now = new Date('2026-08-27T08:30:00Z');
  const originalDate = global.Date;

  it('extracts weather data from closest timeseries entry', async () => {
    const mockResponse = {
      type: 'Feature',
      properties: {
        timeseries: [
          {
            time: '2026-08-27T08:00:00Z',
            data: {
              instant: {
                details: {
                  air_temperature: 18.1,
                  relative_humidity: 59.6,
                  wind_speed: 2.4,
                  air_pressure_at_sea_level: 1025.4,
                  ultraviolet_index_clear_sky: 1.8,
                  cloud_area_fraction: 43.4,
                },
              },
            },
          },
          {
            time: '2026-08-27T09:00:00Z',
            data: {
              instant: {
                details: {
                  air_temperature: 18.9,
                  relative_humidity: 58.0,
                  wind_speed: 2.2,
                  air_pressure_at_sea_level: 1025.6,
                  ultraviolet_index_clear_sky: 2.6,
                  cloud_area_fraction: 44.6,
                },
              },
            },
          },
        ],
      },
    };

    const scope = nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .query(true)
      .reply(200, mockResponse);

    // Mock Date to control "now"
    global.Date = class extends originalDate {
      constructor(...args) {
        if (args.length === 0) return super(now.getTime());
        super(...args);
      }
    };
    global.Date.now = originalDate.now;
    global.Date.UTC = originalDate.UTC;
    global.Date.parse = originalDate.parse;

    const result = await fetchWeather(59.91, 10.75);

    // 08:00 is 30min from 08:30, 09:00 is 30min — first wins (closer index)
    assert.strictEqual(result.temperature, 18.1);
    assert.strictEqual(result.humidity, 59.6);
    assert.strictEqual(result.windSpeed, 2.4);
    assert.strictEqual(result.pressure, 1025.4);
    assert.strictEqual(result.uvIndex, 1.8);
    assert.strictEqual(result.description, 'Mostly clear'); // 43.4 > 25

    // Restore
    global.Date = originalDate;
    scope.done();
  });

  it('derives description from cloud_area_fraction thresholds', async () => {
    const makeTimeSeries = (cloud) => [
      {
        time: '2026-08-27T08:00:00Z',
        data: {
          instant: {
            details: {
              air_temperature: 15,
              relative_humidity: 50,
              wind_speed: 3,
              air_pressure_at_sea_level: 1013,
              ultraviolet_index_clear_sky: 2,
              cloud_area_fraction: cloud,
            },
          },
        },
      },
    ];

    const tests = [
      { cloud: 10, desc: 'Clear' },
      { cloud: 30, desc: 'Mostly clear' },
      { cloud: 60, desc: 'Partly cloudy' },
      { cloud: 80, desc: 'Overcast' },
    ];

    for (const { cloud, desc } of tests) {
      const mockResponse = {
        type: 'Feature',
        properties: { timeseries: makeTimeSeries(cloud) },
      };

      const scope = nock('https://api.met.no')
        .get('/weatherapi/locationforecast/2.0/complete')
        .query(true)
        .reply(200, mockResponse);

      const result = await fetchWeather(59.91, 10.75);
      assert.strictEqual(result.description, desc, `cloud=${cloud} should be "${desc}"`);
      scope.done();
    }
  });

  it('throws when no timeseries data', async () => {
    const scope = nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .query(true)
      .reply(200, { properties: { timeseries: [] } });

    try {
      await fetchWeather(59.91, 10.75);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('No weather data'));
    }
    scope.done();
  });
});
