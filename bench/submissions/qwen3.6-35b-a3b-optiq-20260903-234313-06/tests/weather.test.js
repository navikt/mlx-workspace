import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';

describe('Weather', () => {
  it('should fetch weather and extract data from closest timeseries entry', async () => {
    const now = new Date();
    const pastTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago
    const futureTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 min ahead

    const mockResponse = {
      data: {
        type: 'Feature',
        properties: {
          timeseries: [
            {
              time: pastTime.toISOString(),
              data: {
                instant: {
                  details: {
                    air_temperature: 13.8,
                    relative_humidity: 70.6,
                    wind_speed: 1.6,
                    air_pressure_at_sea_level: 1002.6,
                    ultraviolet_index_clear_sky: 2.5,
                    cloud_area_fraction: 100,
                  },
                },
              },
            },
            {
              time: futureTime.toISOString(),
              data: {
                instant: {
                  details: {
                    air_temperature: 14.2,
                    relative_humidity: 68.0,
                    wind_speed: 2.0,
                    air_pressure_at_sea_level: 1003.0,
                    ultraviolet_index_clear_sky: 3.0,
                    cloud_area_fraction: 50,
                  },
                },
              },
            },
          ],
        },
      },
    };

    mock.method(axios, 'get', () => Promise.resolve(mockResponse));

    const { fetchWeather } = await import('../src/weather.js');
    const result = await fetchWeather(59.91, 10.75);

    // Should pick the closest entry (either past or future are equally close,
    // but the first one found with min diff wins)
    assert.ok(typeof result.temperature === 'number');
    assert.ok(typeof result.description === 'string');
    assert.ok(typeof result.humidity === 'number');
    assert.ok(typeof result.windSpeed === 'number');
    assert.ok(typeof result.pressure === 'number');
    assert.ok(typeof result.uvIndex === 'number');
  });

  it('should derive description from cloud_area_fraction > 75', async () => {
    const mockResponse = {
      data: {
        properties: {
          timeseries: [
            {
              time: new Date().toISOString(),
              data: {
                instant: {
                  details: {
                    air_temperature: 10,
                    relative_humidity: 80,
                    wind_speed: 3,
                    air_pressure_at_sea_level: 1000,
                    ultraviolet_index_clear_sky: 1,
                    cloud_area_fraction: 90,
                  },
                },
              },
            },
          ],
        },
      },
    };

    mock.method(axios, 'get', () => Promise.resolve(mockResponse));

    const { fetchWeather } = await import('../src/weather.js');
    const result = await fetchWeather(59.91, 10.75);

    assert.strictEqual(result.description, 'Overcast');
  });

  it('should derive description from cloud_area_fraction > 50', async () => {
    const mockResponse = {
      data: {
        properties: {
          timeseries: [
            {
              time: new Date().toISOString(),
              data: {
                instant: {
                  details: {
                    air_temperature: 10,
                    relative_humidity: 80,
                    wind_speed: 3,
                    air_pressure_at_sea_level: 1000,
                    ultraviolet_index_clear_sky: 1,
                    cloud_area_fraction: 60,
                  },
                },
              },
            },
          ],
        },
      },
    };

    mock.method(axios, 'get', () => Promise.resolve(mockResponse));

    const { fetchWeather } = await import('../src/weather.js');
    const result = await fetchWeather(59.91, 10.75);

    assert.strictEqual(result.description, 'Partly cloudy');
  });

  it('should derive description from cloud_area_fraction > 25', async () => {
    const mockResponse = {
      data: {
        properties: {
          timeseries: [
            {
              time: new Date().toISOString(),
              data: {
                instant: {
                  details: {
                    air_temperature: 10,
                    relative_humidity: 80,
                    wind_speed: 3,
                    air_pressure_at_sea_level: 1000,
                    ultraviolet_index_clear_sky: 1,
                    cloud_area_fraction: 30,
                  },
                },
              },
            },
          ],
        },
      },
    };

    mock.method(axios, 'get', () => Promise.resolve(mockResponse));

    const { fetchWeather } = await import('../src/weather.js');
    const result = await fetchWeather(59.91, 10.75);

    assert.strictEqual(result.description, 'Mostly clear');
  });

  it('should derive description from cloud_area_fraction <= 25', async () => {
    const mockResponse = {
      data: {
        properties: {
          timeseries: [
            {
              time: new Date().toISOString(),
              data: {
                instant: {
                  details: {
                    air_temperature: 10,
                    relative_humidity: 80,
                    wind_speed: 3,
                    air_pressure_at_sea_level: 1000,
                    ultraviolet_index_clear_sky: 1,
                    cloud_area_fraction: 10,
                  },
                },
              },
            },
          ],
        },
      },
    };

    mock.method(axios, 'get', () => Promise.resolve(mockResponse));

    const { fetchWeather } = await import('../src/weather.js');
    const result = await fetchWeather(59.91, 10.75);

    assert.strictEqual(result.description, 'Clear');
  });

  it('should throw on missing timeseries data', async () => {
    const mockResponse = {
      data: {
        properties: {},
      },
    };

    mock.method(axios, 'get', () => Promise.resolve(mockResponse));

    const { fetchWeather } = await import('../src/weather.js');

    await assert.rejects(
      fetchWeather(59.91, 10.75),
      /missing expected data structure/
    );
  });

  it('should throw on missing instant.details', async () => {
    const mockResponse = {
      data: {
        properties: {
          timeseries: [
            {
              time: new Date().toISOString(),
              data: {
                instant: {},
              },
            },
          ],
        },
      },
    };

    mock.method(axios, 'get', () => Promise.resolve(mockResponse));

    const { fetchWeather } = await import('../src/weather.js');

    await assert.rejects(
      fetchWeather(59.91, 10.75),
      /missing instant\.details/
    );
  });

  it('should throw on 403 error', async () => {
    const error = {
      response: {
        status: 403,
        statusText: 'Forbidden',
      },
    };

    mock.method(axios, 'get', () => Promise.reject(error));

    const { fetchWeather } = await import('../src/weather.js');

    await assert.rejects(
      fetchWeather(59.91, 10.75),
      /User-Agent/
    );
  });

  it('should throw on 429 error', async () => {
    const error = {
      response: {
        status: 429,
        statusText: 'Too Many Requests',
      },
    };

    mock.method(axios, 'get', () => Promise.reject(error));

    const { fetchWeather } = await import('../src/weather.js');

    await assert.rejects(
      fetchWeather(59.91, 10.75),
      /rate limited/
    );
  });

  it('should pick closest timeseries entry to current time', async () => {
    const now = new Date();
    const veryOldTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
    const recentTime = new Date(now.getTime() - 5 * 60 * 1000); // 5 min ago

    const mockResponse = {
      data: {
        properties: {
          timeseries: [
            {
              time: veryOldTime.toISOString(),
              data: {
                instant: {
                  details: {
                    air_temperature: 5,
                    relative_humidity: 90,
                    wind_speed: 5,
                    air_pressure_at_sea_level: 990,
                    ultraviolet_index_clear_sky: 0,
                    cloud_area_fraction: 100,
                  },
                },
              },
            },
            {
              time: recentTime.toISOString(),
              data: {
                instant: {
                  details: {
                    air_temperature: 15,
                    relative_humidity: 60,
                    wind_speed: 2,
                    air_pressure_at_sea_level: 1010,
                    ultraviolet_index_clear_sky: 5,
                    cloud_area_fraction: 0,
                  },
                },
              },
            },
          ],
        },
      },
    };

    mock.method(axios, 'get', () => Promise.resolve(mockResponse));

    const { fetchWeather } = await import('../src/weather.js');
    const result = await fetchWeather(59.91, 10.75);

    // Should pick the recent entry (temp 15, not old entry temp 5)
    assert.strictEqual(result.temperature, 15);
    assert.strictEqual(result.description, 'Clear');
  });
});
