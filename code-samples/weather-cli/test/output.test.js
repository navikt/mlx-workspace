import { describe, it, expect, vi } from 'vitest';
import { formatOutput } from '../output';

describe('formatOutput', () => {
  it('should format weather output for default location', () => {
    const weather = {
      temperature: 12.8,
      humidity: 94.8,
      windSpeed: 2.5,
      pressure: 1013.5,
      uvIndex: 2.8,
      description: 'Overcast'
    };

    const result = formatOutput(weather, 'Bergen');

    expect(result).toContain('Weather in Bergen');
    expect(result).toContain('(Met.no API)');
    expect(result).toContain('Temperature: 12.8°C');
    expect(result).toContain('Description: Overcast');
    expect(result).toContain('Humidity: 94.8%');
    expect(result).toContain('Wind Speed: 2.5 m/s');
    expect(result).toContain('Pressure: 1013.5 hPa');
    expect(result).toContain('UV Index: 2.8');
  });

  it('should format weather output for custom location', () => {
    const weather = {
      temperature: 17.6,
      humidity: 68.9,
      windSpeed: 2.3,
      pressure: 1010.2,
      uvIndex: 3.3,
      description: 'Clear'
    };

    const result = formatOutput(weather, 'Oslo');

    expect(result).toContain('Weather in Oslo');
    expect(result).toContain('(Met.no API)');
    expect(result).toContain('Temperature: 17.6°C');
    expect(result).toContain('Description: Clear');
    expect(result).toContain('Humidity: 68.9%');
    expect(result).toContain('Wind Speed: 2.3 m/s');
    expect(result).toContain('Pressure: 1010.2 hPa');
    expect(result).toContain('UV Index: 3.3');
  });

  it('should format weather output with undefined location name', () => {
    const weather = {
      temperature: 12.8,
      humidity: 94.8,
      windSpeed: 2.5,
      pressure: 1013.5,
      uvIndex: 2.8,
      description: 'Overcast'
    };

    const result = formatOutput(weather, undefined);

    expect(result).toContain('Weather in Bergen');
    expect(result).toContain('(Met.no API)');
  });

  it('should format temperature with decimal places', () => {
    const weather = {
      temperature: 12.85,
      humidity: 94.8,
      windSpeed: 2.5,
      pressure: 1013.5,
      uvIndex: 2.8,
      description: 'Overcast'
    };

    const result = formatOutput(weather, 'Test');

    expect(result).toContain('Temperature: 12.85');
  });

  it('should format humidity with percentage', () => {
    const weather = {
      temperature: 12.8,
      humidity: 50,
      windSpeed: 2.5,
      pressure: 1013.5,
      uvIndex: 2.8,
      description: 'Overcast'
    };

    const result = formatOutput(weather, 'Test');

    expect(result).toContain('Humidity: 50%');
  });

  it('should format wind speed with units', () => {
    const weather = {
      temperature: 12.8,
      humidity: 94.8,
      windSpeed: 5.5,
      pressure: 1013.5,
      uvIndex: 2.8,
      description: 'Overcast'
    };

    const result = formatOutput(weather, 'Test');

    expect(result).toContain('Wind Speed: 5.5 m/s');
  });

  it('should format pressure with units', () => {
    const weather = {
      temperature: 12.8,
      humidity: 94.8,
      windSpeed: 2.5,
      pressure: 1015.0,
      uvIndex: 2.8,
      description: 'Overcast'
    };

    const result = formatOutput(weather, 'Test');

    expect(result).toContain('Pressure: 1015.0 hPa');
  });

  it('should format UV index', () => {
    const weather = {
      temperature: 12.8,
      humidity: 94.8,
      windSpeed: 2.5,
      pressure: 1013.5,
      uvIndex: 5,
      description: 'Overcast'
    };

    const result = formatOutput(weather, 'Test');

    expect(result).toContain('UV Index: 5');
  });

  it('should format all weather data types', () => {
    const weather = {
      temperature: 25.5,
      humidity: 45.2,
      windSpeed: 3.7,
      pressure: 1012.3,
      uvIndex: 7.2,
      description: 'Partly cloudy'
    };

    const result = formatOutput(weather, 'Test Location');

    expect(result).toContain('Weather in Test Location');
    expect(result).toContain('(Met.no API)');
    expect(result).toContain('Temperature: 25.5°C');
    expect(result).toContain('Description: Partly cloudy');
    expect(result).toContain('Humidity: 45.2%');
    expect(result).toContain('Wind Speed: 3.7 m/s');
    expect(result).toContain('Pressure: 1012.3 hPa');
    expect(result).toContain('UV Index: 7.2');
  });
});
