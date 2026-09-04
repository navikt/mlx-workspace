import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation } from './parser.js';
import { geocode } from './geocode.js';
import { fetchWeather } from './weather.js';
import { formatWeather } from './output.js';
import axios from 'axios';

describe('integration', () => {
  it('should handle full flow with coordinates', async () => {
    const locationInput = '59.91 10.75';
    const now = new Date('2026-09-03T22:30:00Z');

    const mockWeatherResponse = {
      data: {
        properties: {
          timeseries: [{
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
          }]
        }
      }
    };

    const axiosGetStub = axios.get;
    axios.get = async () => mockWeatherResponse;

    try {
      const parsed = parseLocation(locationInput);
      assert.equal(parsed.type, 'coords');
      assert.equal(parsed.lat, 59.91);
      assert.equal(parsed.lon, 10.75);

      const weather = await fetchWeather(parsed.lat, parsed.lon, now);

      assert.equal(weather.temperature, 14.8);
      assert.equal(weather.description, 'Overcast');
      assert.equal(weather.humidity, 69.7);
      assert.equal(weather.windSpeed, 2.5);
      assert.equal(weather.pressure, 1003);
      assert.equal(weather.uvIndex, 0);

      const output = formatWeather(`${parsed.lat} ${parsed.lon}`, weather);
      assert.ok(output.includes('Weather in 59.91 10.75'));
      assert.ok(output.includes('Temperature: 14.8°C'));
      assert.ok(output.includes('Description: Overcast'));
      assert.ok(output.includes('Humidity: 69.7%'));
      assert.ok(output.includes('Wind Speed: 2.5 m/s'));
      assert.ok(output.includes('Pressure: 1003 hPa'));
      assert.ok(output.includes('UV Index: 0'));
    } finally {
      axios.get = axiosGetStub;
    }
  });

  it('should handle full flow with location name (geocode + weather)', async () => {
    const locationInput = 'Oslo';
    const now = new Date('2026-09-03T22:30:00Z');

    const mockGeocodeResponse = {
      data: {
        navn: [{
          stedsnavn: [
            { språk: 'Norsk', navnestatus: 'hovednavn', skrivemåte: 'Oslo' }
          ],
          geojson: { geometry: { coordinates: [10.75, 59.91] } }
        }]
      }
    };

    const mockWeatherResponse = {
      data: {
        properties: {
          timeseries: [{
            time: '2026-09-03T22:00:00Z',
            data: {
              instant: {
                details: {
                  air_temperature: 15.0,
                  cloud_area_fraction: 40,
                  relative_humidity: 65,
                  wind_speed: 3.0,
                  air_pressure_at_sea_level: 1010,
                  ultraviolet_index_clear_sky: 2
                }
              }
            }
          }]
        }
      }
    };

    const axiosGetStub = axios.get;
    let callCount = 0;
    axios.get = async (url) => {
      callCount++;
      if (url.includes('geonorge')) {
        return mockGeocodeResponse;
      }
      return mockWeatherResponse;
    };

    try {
      const parsed = parseLocation(locationInput);
      assert.equal(parsed.type, 'name');
      assert.equal(parsed.name, 'Oslo');

      const geoResult = await geocode(parsed.name);
      assert.equal(geoResult.displayName, 'Oslo');
      assert.equal(geoResult.lat, 59.91);
      assert.equal(geoResult.lon, 10.75);

      const weather = await fetchWeather(geoResult.lat, geoResult.lon, now);
      assert.equal(weather.temperature, 15.0);
      assert.equal(weather.description, 'Mostly clear');

      const output = formatWeather(geoResult.displayName, weather);

      assert.ok(output.includes('Weather in Oslo (Met.no API)'));
      assert.ok(output.includes('Temperature: 15°C'));
      assert.ok(output.includes('Description: Mostly clear'));
      assert.ok(output.includes('Humidity: 65%'));
      assert.ok(output.includes('Wind Speed: 3 m/s'));
      assert.ok(output.includes('Pressure: 1010 hPa'));
      assert.ok(output.includes('UV Index: 2'));

      assert.equal(callCount, 2, 'Should call both Geonorge and Met.no APIs');
    } finally {
      axios.get = axiosGetStub;
    }
  });
});
