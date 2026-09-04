import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import { fetchWeather } from '../src/weather.js';

const originalAxios = axios;

describe('Weather', () => {
  let mockWeatherData;

  beforeEach(() => {
    const now = new Date();
    const nowStr = now.toISOString();
    mockWeatherData = {
      properties: {
        timeseries: [
          {
            time: nowStr,
            data: {
              instant: {
                details: {
                  air_temperature: 13.7,
                  relative_humidity: 71.9,
                  wind_speed: 0.7,
                  air_pressure_at_sea_level: 1002.3,
                  ultraviolet_index_clear_sky: 0,
                  cloud_area_fraction: 100
                }
              }
            }
          },
          {
            time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour from now
            data: {
              instant: {
                details: {
                  air_temperature: 13.5,
                  relative_humidity: 72.5,
                  wind_speed: 0.8,
                  air_pressure_at_sea_level: 1002.1,
                  ultraviolet_index_clear_sky: 1,
                  cloud_area_fraction: 50
                }
              }
            }
          }
        ]
      }
    };

    axios.get = async () => ({ data: mockWeatherData });
  });

  afterEach(() => {
    axios.get = originalAxios.get;
  });

  it('should return weather data with correct fields', async () => {
    const result = await fetchWeather(59.91, 10.75);
    assert.ok(result.temperature !== undefined);
    assert.ok(result.description !== undefined);
    assert.ok(result.humidity !== undefined);
    assert.ok(result.windSpeed !== undefined);
    assert.ok(result.pressure !== undefined);
    assert.ok(result.uvIndex !== undefined);
  });

  it('should derive "Overcast" for cloud_area_fraction > 75', async () => {
    mockWeatherData.properties.timeseries[0].data.instant.details.cloud_area_fraction = 100;
    const result = await fetchWeather(59.91, 10.75);
    assert.strictEqual(result.description, 'Overcast');
  });

  it('should derive "Partly cloudy" for cloud_area_fraction > 50', async () => {
    mockWeatherData.properties.timeseries[0].data.instant.details.cloud_area_fraction = 60;
    const result = await fetchWeather(59.91, 10.75);
    assert.strictEqual(result.description, 'Partly cloudy');
  });

  it('should derive "Mostly clear" for cloud_area_fraction > 25', async () => {
    mockWeatherData.properties.timeseries[0].data.instant.details.cloud_area_fraction = 30;
    const result = await fetchWeather(59.91, 10.75);
    assert.strictEqual(result.description, 'Mostly clear');
  });

  it('should derive "Clear" for cloud_area_fraction <= 25', async () => {
    mockWeatherData.properties.timeseries[0].data.instant.details.cloud_area_fraction = 10;
    const result = await fetchWeather(59.91, 10.75);
    assert.strictEqual(result.description, 'Clear');
  });

  it('should derive "Clear" for cloud_area_fraction exactly 25', async () => {
    mockWeatherData.properties.timeseries[0].data.instant.details.cloud_area_fraction = 25;
    const result = await fetchWeather(59.91, 10.75);
    assert.strictEqual(result.description, 'Clear');
  });

  it('should derive "Mostly clear" for cloud_area_fraction exactly 50', async () => {
    mockWeatherData.properties.timeseries[0].data.instant.details.cloud_area_fraction = 50;
    const result = await fetchWeather(59.91, 10.75);
    assert.strictEqual(result.description, 'Mostly clear');
  });

  it('should derive "Partly cloudy" for cloud_area_fraction exactly 75', async () => {
    mockWeatherData.properties.timeseries[0].data.instant.details.cloud_area_fraction = 75;
    const result = await fetchWeather(59.91, 10.75);
    assert.strictEqual(result.description, 'Partly cloudy');
  });

  it('should pick closest timeseries entry to current time', async () => {
    const now = new Date();
    const testTimeseries = [
      {
        time: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        data: {
          instant: {
            details: {
              air_temperature: 10,
              relative_humidity: 80,
              wind_speed: 5,
              air_pressure_at_sea_level: 1000,
              ultraviolet_index_clear_sky: 0,
              cloud_area_fraction: 100
            }
          }
        }
      },
      {
        time: new Date(now.getTime() + 5 * 60 * 1000).toISOString(), // 5 min from now
        data: {
          instant: {
            details: {
              air_temperature: 15,
              relative_humidity: 60,
              wind_speed: 3,
              air_pressure_at_sea_level: 1010,
              ultraviolet_index_clear_sky: 5,
              cloud_area_fraction: 20
            }
          }
        }
      }
    ];

    axios.get = async () => ({ data: { properties: { timeseries: testTimeseries } } });

    const result = await fetchWeather(59.91, 10.75);
    // Should pick the entry closest to now (5 min from now)
    assert.strictEqual(result.temperature, 15);
    assert.strictEqual(result.humidity, 60);
    assert.strictEqual(result.windSpeed, 3);
    assert.strictEqual(result.pressure, 1010);
    assert.strictEqual(result.uvIndex, 5);
    assert.strictEqual(result.description, 'Clear');
  });

  it('should return correct data types', async () => {
    const result = await fetchWeather(59.91, 10.75);
    assert.strictEqual(typeof result.temperature, 'number');
    assert.strictEqual(typeof result.humidity, 'number');
    assert.strictEqual(typeof result.windSpeed, 'number');
    assert.strictEqual(typeof result.pressure, 'number');
    assert.strictEqual(typeof result.uvIndex, 'number');
    assert.strictEqual(typeof result.description, 'string');
  });

  it('should throw on invalid response structure', async () => {
    axios.get = async () => ({ data: {} });
    await assert.rejects(
      fetchWeather(59.91, 10.75),
      /Invalid weather data/
    );
  });

  it('should throw when instant details are missing', async () => {
    mockWeatherData.properties.timeseries[0].data.instant = {};
    await assert.rejects(
      fetchWeather(59.91, 10.75),
      /missing instant details/
    );
  });
});
