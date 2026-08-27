import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { parseArgs, parseCoordinates, parseLocationName } from '../parser';
import { geocode } from '../geocode';
import { fetchWeather } from '../weather';
import { formatOutput } from '../output';

describe('weather-cli integration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exited with code ${code}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('main function with no arguments', () => {
    it('should use default Bergen coordinates', async () => {
      const mockResponse = {
        data: {
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
        }
      };

      const geocodeMock = vi.spyOn(await import('../geocode'), 'geocode');
      const axiosMock = vi.spyOn(axios, 'get');
      axiosMock.mockResolvedValue(mockResponse);

      const locationArg = { location: undefined };
      const weather = await fetchWeather(60.32820331378818, 5.298175036700542);
      const output = formatOutput(weather, 'Bergen');

      expect(output).toContain('Weather in Bergen (Met.no API)');
      expect(output).toContain('Temperature: 17.9°C');
      expect(output).toContain('Description: Overcast');

      axiosMock.mockClear();
    });
  });

  describe('main function with coordinates', () => {
    it('should parse and use coordinates directly', async () => {
      const mockResponse = {
        data: {
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
        }
      };

      const geocodeMock = vi.spyOn(await import('../geocode'), 'geocode');
      const axiosMock = vi.spyOn(axios, 'get');
      axiosMock.mockResolvedValue(mockResponse);

      const args = { location: '63.4305 10.3951' };
      const coords = parseCoordinates(args.location);
      const weather = await fetchWeather(coords.lat, coords.lon);
      const output = formatOutput(weather, 'Coords (63.4305, 10.3951)');

      expect(coords).toEqual({ lat: 63.4305, lon: 10.3951 });
      expect(output).toContain('Weather in Coords (63.4305, 10.3951) (Met.no API)');
      expect(output).toContain('Temperature: 15.3°C');

      axiosMock.mockClear();
    });

    it('should handle invalid coordinates', async () => {
      const args = { location: 'invalid' };
      const coords = parseCoordinates(args.location);

      expect(coords).toBeNull();
    });
  });

  describe('main function with location name', () => {
    it('should geocode location name', async () => {
      const mockGeocodeResponse = {
        data: {
          navn: [{
            geojson: {
              coordinates: [10.73359, 59.91192]
            },
            stedsnavn: [{
              skrivemåte: 'Oslo'
            }]
          }]
        }
      };

      const mockWeatherResponse = {
        data: {
          properties: {
            timeseries: [{
              time: '2026-06-18T08:00:00Z',
              data: {
                instant: {
                  details: {
                    air_temperature: 24.7,
                    relative_humidity: 41.5,
                    wind_speed: 3.9,
                    air_pressure_at_sea_level: 1010.5,
                    cloud_area_fraction: 30,
                    ultraviolet_index_clear_sky: 3.7
                  }
                }
              }
            }]
          }
        }
      };

      const geocodeMock = vi.spyOn(await import('../geocode'), 'geocode');
      const axiosMock = vi.spyOn(axios, 'get');
      
      geocodeMock.mockResolvedValue({
        lat: 59.91192,
        lon: 10.73359,
        name: 'Oslo'
      });
      
      axiosMock.mockResolvedValue(mockWeatherResponse);

      const args = { location: 'Oslo' };
      const coords = parseCoordinates(args.location);
      const geoResult = await geocode(args.location);
      const weather = await fetchWeather(geoResult.lat, geoResult.lon);
      const output = formatOutput(weather, geoResult.name);

      expect(coords).toBeNull();
      expect(geoResult).toEqual({
        lat: 59.91192,
        lon: 10.73359,
        name: 'Oslo'
      });
      expect(output).toContain('Weather in Oslo (Met.no API)');
      expect(output).toContain('Temperature: 24.7°C');

      geocodeMock.mockClear();
      axiosMock.mockClear();
    });

    it('should handle geocoding failure', async () => {
      const args = { location: 'InvalidLocation12345' };
      const coords = parseCoordinates(args.location);

      expect(coords).toBeNull();
    });
  });
});
