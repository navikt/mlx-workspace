import { expect } from 'chai';
import nock from 'nock';
import { fetchWeather } from '../src/weather.js';

describe('fetchWeather', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should fetch weather for Oslo coordinates', async () => {
    const scope = nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .query((q) => q.lat === '59.91' && q.lon === '10.75')
      .reply(200, {
        timeseries: [
          {
            time: new Date().toISOString(),
            uv_index: { max: 2 },
            instant: {
              details: {
                air_temperature: 15.5,
                relative_humidity: 72,
                wind_speed: 3.2,
                pressure: 1013.25,
                cloud_area_fraction: 45
              }
            }
          }
        ]
      });

    const result = await fetchWeather(59.91, 10.75);
    
    expect(result.success).to.equal(true);
    expect(result.temperature).to.equal(15.5);
    expect(result.humidity).to.equal(72);
    expect(result.windSpeed).to.equal(3.2);
    expect(result.pressure).to.equal(1013.25);
    expect(result.uvIndex).to.equal(2);
    expect(result.cloudAreaFraction).to.equal(45);
  });

  it('should find closest timeseries entry to current time', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
    const future = new Date(now.getTime() + 7200000).toISOString(); // 2 hours ahead

    nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .query((q) => q.lat === '59.91')
      .reply(200, {
        timeseries: [
          {
            time: past,
            uv_index: { max: 1 },
            instant: {
              details: {
                air_temperature: 10,
                relative_humidity: 80,
                wind_speed: 2,
                pressure: 1010,
                cloud_area_fraction: 50
              }
            }
          },
          {
            time: now.toISOString(),
            uv_index: { max: 2 },
            instant: {
              details: {
                air_temperature: 15,
                relative_humidity: 70,
                wind_speed: 3,
                pressure: 1013,
                cloud_area_fraction: 30
              }
            }
          },
          {
            time: future,
            uv_index: { max: 3 },
            instant: {
              details: {
                air_temperature: 18,
                relative_humidity: 60,
                wind_speed: 4,
                pressure: 1015,
                cloud_area_fraction: 20
              }
            }
          }
        ]
      });

    const result = await fetchWeather(59.91, 10.75);
    
    expect(result.success).to.equal(true);
    expect(result.temperature).to.equal(15); // Should pick current time entry
  });

  it('should use User-Agent header', async () => {
    let userAgent = null;
    
    nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .query(true)
      .reply(200, function(uri, requestBody) {
        userAgent = this.req.headers['user-agent'];
        return {
          timeseries: [
            {
              time: new Date().toISOString(),
              uv_index: { max: 1 },
              instant: {
                details: {
                  air_temperature: 10,
                  relative_humidity: 50,
                  wind_speed: 1,
                  pressure: 1000,
                  cloud_area_fraction: 0
                }
              }
            }
          ]
        };
      });

    await fetchWeather(59.91, 10.75);
    
    expect(userAgent).to.include('weather-cli/1.0');
  });

  it('should handle API errors', async () => {
    nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .reply(500, '{"error": "Internal Server Error"}');

    const result = await fetchWeather(59.91, 10.75);
    
    expect(result.success).to.equal(false);
    expect(result.error).to.include('Weather API error');
  });

  it('should handle empty timeseries', async () => {
    nock('https://api.met.no')
      .get('/weatherapi/locationforecast/2.0/complete')
      .reply(200, {
        timeseries: []
      });

    const result = await fetchWeather(59.91, 10.75);
    
    expect(result.success).to.equal(false);
    expect(result.error).to.include('No weather data available');
  });
});
