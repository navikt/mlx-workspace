const { fetchWeather } = require('./weather');
const axios = require('axios');

jest.mock('axios');

describe('fetchWeather', () => {
  const mockData = {
    data: {
      properties: {
        timeseries: [{
          data: {
            instant: {
              details: {
                air_temperature: 15.5,
                relative_humidity: 80,
                wind_speed: 5.2,
                air_pressure_at_sea_level: 1013.2,
                ultraviolet_index_clear_sky: 3,
                cloud_area_fraction: 60
              }
            }
          }
        }]
      }
    }
  };

  test('returns weather details on success', async () => {
    axios.get.mockResolvedValue(mockData);

    const result = await fetchWeather(59.91, 10.75);
    expect(result).toEqual({
      temperature: 15.5,
      humidity: 80,
      windSpeed: 5.2,
      pressure: 1013.2,
      uvIndex: 3,
      cloudAreaFraction: 60
    });
  });

  test('throws error when timeseries is empty', async () => {
    axios.get.mockResolvedValue({ data: { properties: { timeseries: [] } } });

    await expect(fetchWeather(59.91, 10.75)).rejects.toThrow('No weather data available');
  });

  test('throws error on API failure', async () => {
    axios.get.mockRejectedValue(new Error('API Error'));

    await expect(fetchWeather(59.91, 10.75)).rejects.toThrow('API Error');
  });
});
