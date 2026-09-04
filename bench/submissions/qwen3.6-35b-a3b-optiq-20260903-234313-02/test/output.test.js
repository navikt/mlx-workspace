import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatWeather, output } from '../src/output.js';

describe('output', () => {
  it('formats weather data correctly', () => {
    const weather = {
      temperature: 6.1,
      description: 'Partly cloudy',
      humidity: 72,
      windSpeed: 4.2,
      pressure: 1012.8,
      uvIndex: 1.2
    };

    const result = formatWeather('Oslo', weather);

    const expected = [
      'Weather in Oslo (Met.no API)',
      'Temperature: 6.1°C',
      'Description: Partly cloudy',
      'Humidity: 72%',
      'Wind Speed: 4.2 m/s',
      'Pressure: 1012.8 hPa',
      'UV Index: 1.2'
    ].join('\n');

    assert.equal(result, expected);
  });

  it('includes location name in first line', () => {
    const weather = {
      temperature: 0,
      description: 'Clear',
      humidity: 50,
      windSpeed: 0,
      pressure: 1000,
      uvIndex: 0
    };

    const result = formatWeather('Bergen', weather);
    assert.ok(result.startsWith('Weather in Bergen'));
  });

  it('outputs correct format with integer values', () => {
    const weather = {
      temperature: 10,
      description: 'Overcast',
      humidity: 90,
      windSpeed: 5,
      pressure: 1013,
      uvIndex: 2
    };

    const result = formatWeather('Trondheim', weather);

    const expected = [
      'Weather in Trondheim (Met.no API)',
      'Temperature: 10°C',
      'Description: Overcast',
      'Humidity: 90%',
      'Wind Speed: 5 m/s',
      'Pressure: 1013 hPa',
      'UV Index: 2'
    ].join('\n');

    assert.equal(result, expected);
  });

  it('outputs exactly 7 lines', () => {
    const weather = {
      temperature: 5,
      description: 'Clear',
      humidity: 60,
      windSpeed: 3,
      pressure: 1010,
      uvIndex: 1
    };

    const result = formatWeather('Test', weather);
    const lines = result.split('\n');
    assert.equal(lines.length, 7);
  });

  it('output function prints to console', () => {
    const weather = {
      temperature: 5,
      description: 'Clear',
      humidity: 60,
      windSpeed: 3,
      pressure: 1010,
      uvIndex: 1
    };

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    output('Test', weather);

    console.log = originalLog;

    assert.equal(logs.length, 1);
    assert.ok(logs[0].includes('Weather in Test'));
    assert.ok(logs[0].includes('Temperature: 5'));
  });
});
