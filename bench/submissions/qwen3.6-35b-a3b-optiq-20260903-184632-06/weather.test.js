import assert from 'node:assert';
import { test } from 'node:test';
import axios from 'axios';
import { fetchWeather } from './src/weather.js';

const mockAxiosGet = axios.get;

function createMockResponse(metnoData) {
  return {
    data: metnoData,
    status: 200,
  };
}

test('fetchWeather selects closest timeseries entry to current time in UTC', async () => {
  const now = new Date();
  const closestTime = new Date(now.getTime() + 1800000); // 30 min from now
  const farTime = new Date(now.getTime() + 86400000); // 24 hours from now

  const mockData = {
    properties: {
      timeseries: [
        { time: farTime.toISOString(), data: { instant: { details: { air_temperature: 5 } } } },
        { time: closestTime.toISOString(), data: { instant: { details: { air_temperature: 20 } } } },
      ],
    },
  };

  axios.get = async () => createMockResponse(mockData);

  const result = await fetchWeather(59.91, 10.75);
  assert.strictEqual(result.temperature, 20);

  axios.get = mockAxiosGet;
});

test('fetchWeather extracts all required fields', async () => {
  const now = new Date();
  const mockData = {
    properties: {
      timeseries: [{
        time: now.toISOString(),
        data: {
          instant: {
            details: {
              air_temperature: 15.3,
              relative_humidity: 75.8,
              wind_speed: 3.2,
              air_pressure_at_sea_level: 1000.7,
              cloud_area_fraction: 86.0,
              ultraviolet_index_clear_sky: 2.8,
            },
          },
        },
      }],
    },
  };

  axios.get = async () => createMockResponse(mockData);

  const result = await fetchWeather(59.91, 10.75);
  assert.strictEqual(result.temperature, 15.3);
  assert.strictEqual(result.humidity, 75.8);
  assert.strictEqual(result.windSpeed, 3.2);
  assert.strictEqual(result.pressure, 1000.7);
  assert.strictEqual(result.uvIndex, 2.8);
  assert.strictEqual(result.cloudArea, 86.0);

  axios.get = mockAxiosGet;
});

test('fetchWeather handles missing ultraviolet_index_clear_sky', async () => {
  const now = new Date();
  const mockData = {
    properties: {
      timeseries: [{
        time: now.toISOString(),
        data: {
          instant: {
            details: {
              air_temperature: 12.0,
              relative_humidity: 80.0,
              wind_speed: 2.0,
              air_pressure_at_sea_level: 1005.0,
              cloud_area_fraction: 50.0,
              // ultraviolet_index_clear_sky is intentionally missing
            },
          },
        },
      }],
    },
  };

  axios.get = async () => createMockResponse(mockData);

  const result = await fetchWeather(59.91, 10.75);
  assert.strictEqual(result.uvIndex, null);
  assert.strictEqual(result.cloudArea, 50.0);

  axios.get = mockAxiosGet;
});

test('fetchWeather handles missing cloud_area_fraction', async () => {
  const now = new Date();
  const mockData = {
    properties: {
      timeseries: [{
        time: now.toISOString(),
        data: {
          instant: {
            details: {
              air_temperature: 12.0,
              relative_humidity: 80.0,
              wind_speed: 2.0,
              air_pressure_at_sea_level: 1005.0,
              // cloud_area_fraction is intentionally missing
              ultraviolet_index_clear_sky: 1.5,
            },
          },
        },
      }],
    },
  };

  axios.get = async () => createMockResponse(mockData);

  const result = await fetchWeather(59.91, 10.75);
  assert.strictEqual(result.cloudArea, null);
  assert.strictEqual(result.uvIndex, 1.5);

  axios.get = mockAxiosGet;
});

test('fetchWeather throws on empty timeseries', async () => {
  const mockData = {
    properties: {
      timeseries: [],
    },
  };

  axios.get = async () => createMockResponse(mockData);

  try {
    await fetchWeather(59.91, 10.75);
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('No weather data'));
  }

  axios.get = mockAxiosGet;
});

test('fetchWeather throws on missing timeseries', async () => {
  const mockData = {
    properties: {},
  };

  axios.get = async () => createMockResponse(mockData);

  try {
    await fetchWeather(59.91, 10.75);
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('No weather data'));
  }

  axios.get = mockAxiosGet;
});

test('fetchWeather uses correct User-Agent header', async () => {
  let capturedHeaders = {};
  axios.get = async (_url, config) => {
    capturedHeaders = config.headers;
    return createMockResponse({
      properties: {
        timeseries: [{
          time: new Date().toISOString(),
          data: {
            instant: {
              details: {
                air_temperature: 10,
                relative_humidity: 50,
                wind_speed: 1,
                air_pressure_at_sea_level: 1000,
                cloud_area_fraction: 10,
                ultraviolet_index_clear_sky: 0.5,
              },
            },
          },
        }],
      },
    });
  };

  await fetchWeather(59.91, 10.75);
  const userAgent = capturedHeaders['User-Agent'] || capturedHeaders['user-agent'] || capturedHeaders.UserAgent;
  assert.ok(userAgent, `Headers: ${JSON.stringify(capturedHeaders)}`);
  assert.ok(!userAgent.includes('example.com'));
  assert.ok(!userAgent.includes('Mozilla'));
  assert.ok(!userAgent.includes('curl'));

  axios.get = mockAxiosGet;
});
