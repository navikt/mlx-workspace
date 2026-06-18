import { describe, it, expect, vi } from 'vitest';
import { fetchWeather, parseWeatherData, getWeatherDescription } from '../weather';

describe('getWeatherDescription', () => {
  it('should return "Clear" for low cloud fraction', () => {
    expect(getWeatherDescription(10)).toBe('Clear');
  });

  it('should return "Mostly clear" for medium cloud fraction', () => {
    expect(getWeatherDescription(30)).toBe('Mostly clear');
  });

  it('should return "Partly cloudy" for high cloud fraction', () => {
    expect(getWeatherDescription(60)).toBe('Partly cloudy');
  });

  it('should return "Overcast" for very high cloud fraction', () => {
    expect(getWeatherDescription(90)).toBe('Overcast');
  });

  it('should return "Clear" for zero cloud fraction', () => {
    expect(getWeatherDescription(0)).toBe('Clear');
  });

  it('should return "Clear" for negative cloud fraction', () => {
    expect(getWeatherDescription(-1)).toBe('Clear');
  });
});

describe('parseWeatherData', () => {
  it('should parse weather data correctly', () => {
    const rawData = {
      properties: {
        timeseries: [{
          time: '2026-06-18T08:00:00Z',
          data: {
            instant: {
              details: {
                air_temperature: 12.8,
                relative_humidity: 94.8,
                wind_speed: 2.5,
                air_pressure_at_sea_level: 1013.5,
                cloud_area_fraction: 99.9,
                ultraviolet_index_clear_sky: 2.8
              }
            }
          }
        }]
      }
    };

    const result = parseWeatherData(rawData);

    expect(result).toEqual({
      temperature: 12.80,
      humidity: 94.8,
      windSpeed: 2.5,
      pressure: 1013.5,
      uvIndex: 2.8,
      description: 'Overcast'
    });
  });

  it('should parse weather data with different values', () => {
    const rawData = {
      properties: {
        timeseries: [{
          time: '2026-06-18T08:00:00Z',
          data: {
            instant: {
              details: {
                air_temperature: 17.6,
                relative_humidity: 68.9,
                wind_speed: 2.3,
                air_pressure_at_sea_level: 1010.2,
                cloud_area_fraction: 10,
                ultraviolet_index_clear_sky: 3.3
              }
            }
          }
        }]
      }
    };

    const result = parseWeatherData(rawData);

    expect(result).toEqual({
      temperature: 17.60,
      humidity: 68.9,
      windSpeed: 2.3,
      pressure: 1010.2,
      uvIndex: 3.3,
      description: 'Clear'
    });
  });

  it('should find closest time match in timeseries', () => {
    const rawData = {
      properties: {
        timeseries: [
          { time: '2026-06-18T07:00:00Z', data: { instant: { details: { air_temperature: 10.0 } } } },
          { time: '2026-06-18T08:00:00Z', data: { instant: { details: { air_temperature: 15.0 } } } },
          { time: '2026-06-18T09:00:00Z', data: { instant: { details: { air_temperature: 20.0 } } } }
        ]
      }
    };

    const result = parseWeatherData(rawData);

    expect(result.temperature).toBe(20.0);
  });

  it('should return first entry if no time match found', () => {
    const rawData = {
      properties: {
        timeseries: [
          { time: '2026-06-18T07:00:00Z', data: { instant: { details: { air_temperature: 10.0 } } } }
        ]
      }
    };

    const result = parseWeatherData(rawData);

    expect(result.temperature).toBe(10.0);
  });
});

describe('fetchWeather', () => {
  it('should fetch weather data from API', async () => {
    const mockResponse = {
      data: {
        properties: {
          timeseries: [{
            time: '2026-06-18T08:00:00Z',
            data: {
              instant: {
                details: {
                  air_temperature: 12.8,
                  relative_humidity: 94.8,
                  wind_speed: 2.5,
                  air_pressure_at_sea_level: 1013.5,
                  cloud_area_fraction: 99.9,
                  ultraviolet_index_clear_sky: 2.8
                }
              }
            }
          }]
        }
      }
    };

    const axiosMock = vi.spyOn(require('axios'), 'get');
    axiosMock.mockResolvedValue(mockResponse);

    const result = await fetchWeather(60.32820331378818, 5.298175036700542);

    expect(axiosMock).toHaveBeenCalledWith(
      'https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=60.32820331378818&lon=5.298175036700542',
      expect.any(Object)
    );

    expect(result).toEqual({
      temperature: 12.80,
      humidity: 94.8,
      windSpeed: 2.5,
      pressure: 1013.5,
      uvIndex: 2.8,
      description: 'Overcast'
    });

    axiosMock.mockClear();
  });

  it('should throw error when API request fails', async () => {
    const axiosMock = vi.spyOn(require('axios'), 'get');
    axiosMock.mockRejectedValue(new Error('Network error'));

    await expect(fetchWeather(60.32820331378818, 5.298175036700542)).rejects.toThrow('Network error');

    axiosMock.mockClear();
  });

  it('should handle missing timeseries data', () => {
    const rawData = {
      properties: {
        timeseries: []
      }
    };

    const result = parseWeatherData(rawData);

    expect(result).toEqual({
      temperature: undefined,
      humidity: undefined,
      windSpeed: undefined,
      pressure: undefined,
      uvIndex: undefined,
      description: 'Clear'
    });
  });
  });
});
