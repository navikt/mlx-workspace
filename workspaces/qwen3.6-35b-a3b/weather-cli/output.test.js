const { formatOutput } = require('./output');
const { expect } = require('chai');

describe('output', () => {
  it('should format weather data correctly', () => {
    const weather = {
      temperature: 15.5,
      description: 'Clear',
      humidity: 65,
      windSpeed: 4.2,
      pressure: 1013.2,
      uvIndex: 3.0,
    };

    const output = formatOutput(weather, 'Oslo');
    const expected = [
      'Weather in Oslo (Met.no API)',
      'Temperature: 15.5°C',
      'Description: Clear',
      'Humidity: 65%',
      'Wind Speed: 4.2 m/s',
      'Pressure: 1013.2 hPa',
      'UV Index: 3',
    ].join('\n');

    expect(output).to.equal(expected);
  });

  it('should use custom source when provided', () => {
    const weather = {
      temperature: 10,
      description: 'Overcast',
      humidity: 80,
      windSpeed: 5,
      pressure: 1000,
      uvIndex: 1,
    };

    const output = formatOutput(weather, 'Bergen', 'Custom Source');
    expect(output).to.include('Custom Source');
    expect(output).to.not.include('Met.no API');
  });

  it('should format integer values correctly', () => {
    const weather = {
      temperature: 10,
      description: 'Clear',
      humidity: 50,
      windSpeed: 3,
      pressure: 1010,
      uvIndex: 2,
    };

    const output = formatOutput(weather, 'Test');
    expect(output).to.include('Temperature: 10°C');
    expect(output).to.include('Humidity: 50%');
    expect(output).to.include('Wind Speed: 3 m/s');
    expect(output).to.include('Pressure: 1010 hPa');
    expect(output).to.include('UV Index: 2');
  });
});
