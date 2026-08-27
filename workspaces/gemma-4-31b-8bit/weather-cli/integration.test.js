const { parseArgs } = require('./parser');
const { geocode } = require('./geocode');
const { fetchWeather } = require('./weather');
const { formatWeather } = require('./output');
const axios = require('axios');

jest.mock('axios');

describe('Integration', () => {
  test('full flow with location name', async () => {
    const mockGeoResponse = {
      data: {
        navn: [{
          geojson: { geometry: { coordinates: [10.73, 59.91] } },
          stedsnavn: [{ skrivemåte: 'Oslo' }]
        }]
      }
    };
    const mockWeatherResponse = {
      data: {
        properties: {
          timeseries: [{
            data: {
              instant: {
                details: {
                  air_temperature: 15,
                  relative_humidity: 80,
                  wind_speed: 5,
                  air_pressure_at_sea_level: 1013,
                  ultraviolet_index_clear_sky: 3,
                  cloud_area_fraction: 10
                }
              }
            }
          }]
        }
      }
    };

    axios.get
      .mockResolvedValueOnce(mockGeoResponse)
      .mockResolvedValueOnce(mockWeatherResponse);

    const args = ['Oslo'];
    const locationInput = parseArgs(args);
    const geo = await geocode(locationInput.name);
    const weather = await fetchWeather(geo.lat, geo.lon);
    const output = formatWeather(geo.name, weather);

    expect(output).toContain('Weather in Oslo (Met.no API)');
    expect(output).toContain('Temperature: 15°C');
    expect(output).toContain('Description: Clear');
  });

  test('full flow with coordinates', async () => {
    const mockWeatherResponse = {
      data: {
        properties: {
          timeseries: [{
            data: {
              instant: {
                details: {
                  air_temperature: 12,
                  relative_humidity: 70,
                  wind_speed: 4,
                  air_pressure_at_sea_level: 1010,
                  ultraviolet_index_clear_sky: 2,
                  cloud_area_fraction: 60
                }
              }
            }
          }]
        }
      }
    };

    axios.get.mockResolvedValue(mockWeatherResponse);

    const args = ['59.91 10.75'];
    const locationInput = parseArgs(args);
    const weather = await fetchWeather(locationInput.lat, locationInput.lon);
    const output = formatWeather(`${locationInput.lat}, ${locationInput.lon}`, weather);

    expect(output).toContain('Weather in 59.91, 10.75 (Met.no API)');
    expect(output).toContain('Temperature: 12°C');
    expect(output).toContain('Description: Partly cloudy');
  });
});
