import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { fetchWeather } from '../src/weather.js';
import axios from 'axios';

const originalExit = process.exit;
let exitCode = null;

describe('Weather', () => {
  let originalGet;

  before(() => {
    process.exit = (code) => {
      exitCode = code;
      throw new Error('exit');
    };
  });

  after(() => {
    process.exit = originalExit;
  });

  beforeEach(() => {
    exitCode = null;
    originalGet = axios.get;
  });

  afterEach(() => {
    axios.get = originalGet;
  });

  it('should return weather data from Met.no API', async () => {
    const mockResponse = {
      data: {
        properties: {
          timeseries: [
            {
              time: new Date().toISOString(),
              instant: {
                details: {
                  temperature: 15.5,
                  relative_humidity: 65,
                  wind_speed: 3.2,
                  air_pressure_at_sea_level: 1013,
                  ultraviolet_index_clear_sky: 2,
                  cloud_area_fraction: 50
                }
              }
            }
          ]
        }
      },
      status: 200
    };

    axios.get = async () => mockResponse;

    const result = await fetchWeather(59.91, 10.75, 'weather-cli/1.0 test');
    assert.strictEqual(result.properties.timeseries.length, 1);
    assert.strictEqual(result.properties.timeseries[0].instant.details.temperature, 15.5);
  });

  it('should exit with code 1 on 403 error', async () => {
    axios.get = async () => {
      throw { response: { status: 403 } };
    };

    try {
      await fetchWeather(59.91, 10.75, 'weather-cli/1.0 test');
      assert.fail('Should have exited');
    } catch (err) {
      assert.strictEqual(exitCode, 1);
    }
  });

  it('should exit with code 1 on 429 error', async () => {
    axios.get = async () => {
      throw { response: { status: 429 } };
    };

    try {
      await fetchWeather(59.91, 10.75, 'weather-cli/1.0 test');
      assert.fail('Should have exited');
    } catch (err) {
      assert.strictEqual(exitCode, 1);
    }
  });

  it('should exit with code 1 on timeout', async () => {
    axios.get = async () => {
      throw { code: 'ECONNABORTED' };
    };

    try {
      await fetchWeather(59.91, 10.75, 'weather-cli/1.0 test');
      assert.fail('Should have exited');
    } catch (err) {
      assert.strictEqual(exitCode, 1);
    }
  });
});
