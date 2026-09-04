import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import { formatOutput } from '../src/output.js';
import { findClosestTimeseries } from '../src/weather.js';

const originalExit = process.exit;
let exitCode = null;

describe('Integration', () => {
  before(() => {
    process.exit = (code) => {
      exitCode = code;
      throw new Error('exit');
    };
  });

  after(() => {
    process.exit = originalExit;
  });

  it('should produce correct full output with mocked API responses', () => {
    const mockGeoData = {
      geometry: { coordinates: [10.73353, 59.91187] },
      stedsnavn: [{ skrivemåte: 'Oslo' }]
    };

    const now = new Date('2024-01-15T12:00:00Z');
    const mockWeatherData = {
      properties: {
        timeseries: [
          {
            time: '2024-01-15T10:00:00Z',
            instant: { details: { temperature: 14, cloud_area_fraction: 10 } }
          },
          {
            time: '2024-01-15T12:00:00Z',
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
          },
          {
            time: '2024-01-15T14:00:00Z',
            instant: { details: { temperature: 16 } }
          }
        ]
      }
    };

    const closest = findClosestTimeseries(mockWeatherData.properties.timeseries, now);
    const output = formatOutput('Oslo', closest);

    assert.ok(output.includes('Weather in Oslo (Met.no API)'));
    assert.ok(output.includes('Temperature: 15.5°C'));
    assert.ok(output.includes('Description: Mostly clear'));
    assert.ok(output.includes('Humidity: 65%'));
    assert.ok(output.includes('Wind Speed: 3.2 m/s'));
    assert.ok(output.includes('Pressure: 1013 hPa'));
    assert.ok(output.includes('UV Index: 2'));
  });

  it('should handle missing data gracefully in full pipeline', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const mockWeatherData = {
      properties: {
        timeseries: [
          {
            time: '2024-01-15T12:00:00Z',
            instant: { details: {} }
          }
        ]
      }
    };

    const closest = findClosestTimeseries(mockWeatherData.properties.timeseries, now);
    const output = formatOutput('Test City', closest);

    assert.ok(output.includes('Temperature: N/A'));
    assert.ok(output.includes('Description: Unknown'));
    assert.ok(output.includes('Humidity: N/A'));
    assert.ok(output.includes('Wind Speed: N/A'));
    assert.ok(output.includes('Pressure: N/A'));
    assert.ok(output.includes('UV Index: N/A'));
  });

  it('should handle coordinates input path', () => {
    const location = '59.91 10.75';
    const coordMatch = location.match(/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/);

    assert.ok(coordMatch);
    assert.strictEqual(parseFloat(coordMatch[1]), 59.91);
    assert.strictEqual(parseFloat(coordMatch[2]), 10.75);
  });

  it('should detect non-coordinate input', () => {
    const location = 'Oslo';
    const coordMatch = location.match(/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/);

    assert.strictEqual(coordMatch, null);
  });

  it('should validate invalid coordinates', () => {
    const location = '100 200';
    const coordMatch = location.match(/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/);

    assert.ok(coordMatch);
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    assert.ok(lat < -90 || lat > 90 || lon < -180 || lon > 180);
  });
});
