import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatOutput } from '../src/output.js';

describe('Output', () => {
  it('should format weather output correctly', () => {
    const timeseries = {
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
    };

    const result = formatOutput('Oslo', timeseries);

    assert.ok(result.includes('Weather in Oslo (Met.no API)'));
    assert.ok(result.includes('Temperature: 15.5°C'));
    assert.ok(result.includes('Description: Mostly clear'));
    assert.ok(result.includes('Humidity: 65%'));
    assert.ok(result.includes('Wind Speed: 3.2 m/s'));
    assert.ok(result.includes('Pressure: 1013 hPa'));
    assert.ok(result.includes('UV Index: 2'));
  });

  it('should show "Overcast" when cloud_area_fraction > 75', () => {
    const timeseries = {
      instant: {
        details: {
          temperature: 10,
          cloud_area_fraction: 76
        }
      }
    };

    const result = formatOutput('Bergen', timeseries);
    assert.ok(result.includes('Description: Overcast'));
  });

  it('should show "Overcast" when cloud_area_fraction === 75', () => {
    const timeseries = {
      instant: {
        details: {
          temperature: 10,
          cloud_area_fraction: 75
        }
      }
    };

    const result = formatOutput('Bergen', timeseries);
    assert.ok(result.includes('Description: Partly cloudy'));
  });

  it('should show "Mostly clear" when cloud_area_fraction > 25 and <= 50', () => {
    const timeseries = {
      instant: {
        details: {
          temperature: 10,
          cloud_area_fraction: 26
        }
      }
    };

    const result = formatOutput('Tromsø', timeseries);
    assert.ok(result.includes('Description: Mostly clear'));
  });

  it('should show "Clear" when cloud_area_fraction <= 25', () => {
    const timeseries = {
      instant: {
        details: {
          temperature: 10,
          cloud_area_fraction: 25
        }
      }
    };

    const result = formatOutput('Tromsø', timeseries);
    assert.ok(result.includes('Description: Clear'));
  });

  it('should show "Unknown" when cloud_area_fraction is missing', () => {
    const timeseries = {
      instant: {
        details: {
          temperature: 10
        }
      }
    };

    const result = formatOutput('Trondheim', timeseries);
    assert.ok(result.includes('Description: Unknown'));
  });

  it('should show "N/A" for missing fields', () => {
    const timeseries = {
      instant: {
        details: {}
      }
    };

    const result = formatOutput('Stavanger', timeseries);
    assert.ok(result.includes('Temperature: N/A'));
    assert.ok(result.includes('Humidity: N/A'));
    assert.ok(result.includes('Wind Speed: N/A'));
    assert.ok(result.includes('Pressure: N/A'));
    assert.ok(result.includes('UV Index: N/A'));
  });

  it('should show "N/A" for null values', () => {
    const timeseries = {
      instant: {
        details: {
          temperature: null,
          relative_humidity: null,
          wind_speed: null,
          air_pressure_at_sea_level: null,
          ultraviolet_index_clear_sky: null,
          cloud_area_fraction: null
        }
      }
    };

    const result = formatOutput('Bodø', timeseries);
    assert.ok(result.includes('Temperature: N/A'));
    assert.ok(result.includes('Humidity: N/A'));
    assert.ok(result.includes('Wind Speed: N/A'));
    assert.ok(result.includes('Pressure: N/A'));
    assert.ok(result.includes('UV Index: N/A'));
    assert.ok(result.includes('Description: Unknown'));
  });

  it('should handle missing instant object', () => {
    const timeseries = {};

    const result = formatOutput('Lillehammer', timeseries);
    assert.ok(result.includes('Description: Unknown'));
    assert.ok(result.includes('Temperature: N/A'));
  });
});
