import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { geocode, DEFAULT_USER_AGENT } from '../geocode';

describe('geocode', () => {
  let axiosMock;

  beforeEach(() => {
    axiosMock = vi.spyOn(require('axios'), 'get');
  });

  afterEach(() => {
    axiosMock.mockClear();
  });

  it('should return coordinates for valid location', async () => {
    const mockResponse = {
      data: {
        navn: [{
          geojson: {
            geometry: {
              coordinates: [10.73353, 59.91187]
            }
          },
          navn: 'Oslo fylke'
        }]
      }
    };

    axiosMock.mockResolvedValue(mockResponse);

    const result = await geocode('Oslo');

    expect(result).toEqual({
      lat: 59.91187,
      lon: 10.73353,
      name: 'Oslo fylke'
    });
  });

  it('should return coordinates for location with full name', async () => {
    const mockResponse = {
      data: {
        navn: [{
          geojson: {
            geometry: {
              coordinates: [10.73359, 59.91192]
            }
          },
          stedsnavn: [{
            skrivemåte: 'Oslo kommune'
          }]
        }]
      }
    };

    axiosMock.mockResolvedValue(mockResponse);

    const result = await geocode('Oslo kommune');

    expect(result).toEqual({
      lat: 59.91192,
      lon: 10.73359,
      name: 'Oslo kommune'
    });
  });

  it('should return null for invalid location', async () => {
    const mockResponse = { data: { navn: [] } };
    const axiosMock = vi.spyOn(axios, 'get');
    axiosMock.mockResolvedValue(mockResponse);

    const result = await geocode('InvalidLocation12345');
    expect(result).toBeNull();
  });

  it('should return null when API returns no results', async () => {
    const mockResponse = { data: null };
    const axiosMock = vi.spyOn(axios, 'get');
    axiosMock.mockResolvedValue(mockResponse);

    const result = await geocode('NonExistentLocation');
    expect(result).toBeNull();
  });

  it('should return null when geojson coordinates are missing', async () => {
    const mockResponse = {
      data: {
        navn: [{
          geojson: {
            geometry: {
              type: 'Polygon'
            }
          },
          navn: 'TestLocation'
        }]
      }
    };

    const axiosMock = vi.spyOn(axios, 'get');
    axiosMock.mockResolvedValue(mockResponse);

    const result = await geocode('TestLocation');
    expect(result).toBeNull();
  });

  it('should return null when coordinates array has wrong length', async () => {
    const mockResponse = {
      data: {
        navn: [{
          geojson: {
            geometry: {
              coordinates: [10.73353, 59.91187, 50]
            }
          },
          navn: 'TestLocation'
        }]
      }
    };

    const axiosMock = vi.spyOn(axios, 'get');
    axiosMock.mockResolvedValue(mockResponse);

    const result = await geocode('TestLocation');
    expect(result).toBeNull();
  });

  it('should handle API errors gracefully', async () => {
    axiosMock.mockRejectedValue(new Error('Network error'));

    const result = await geocode('Oslo');
    expect(result).toBeNull();
  });

  it('should encode location name with special characters', async () => {
    const mockResponse = {
      data: {
        navn: [{
          geojson: {
            geometry: {
              coordinates: [10.73353, 59.91187]
            }
          },
          navn: 'Test Location'
        }]
      }
    };

    const axiosMock = vi.spyOn(axios, 'get');
    axiosMock.mockResolvedValue(mockResponse);

    const result = await geocode('Test Location');

    expect(axiosMock).toHaveBeenCalledWith(
      expect.stringContaining('sok=Test%20Location'),
      expect.objectContaining({
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
    );

    expect(result).toEqual({
      lat: 59.91187,
      lon: 10.73353,
      name: 'Test Location'
    });
  });
});
