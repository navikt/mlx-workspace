import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatOutput } from '../output.js';

describe('output.test.js', () => {
  it('formats weather data correctly', () => {
    const weather = {
      temperature: 18.1,
      description: 'Partly cloudy',
      humidity: 59.6,
      windSpeed: 2.4,
      pressure: 1025.4,
      uvIndex: 1.8,
    };

    const result = formatOutput('Oslo', weather);
    const expected = [
      'Weather in Oslo (Met.no API)',
      'Temperature: 18.1°C',
      'Description: Partly cloudy',
      'Humidity: 59.6%',
      'Wind Speed: 2.4 m/s',
      'Pressure: 1025.4 hPa',
      'UV Index: 1.8',
    ].join('\n');

    assert.strictEqual(result, expected);
  });

  it('handles coordinate location names', () => {
    const weather = {
      temperature: 20,
      description: 'Clear',
      humidity: 45,
      windSpeed: 5,
      pressure: 1013,
      uvIndex: 3,
    };

    const result = formatOutput('59.91 10.75', weather);
    assert.ok(result.startsWith('Weather in 59.91 10.75'));
  });
});
