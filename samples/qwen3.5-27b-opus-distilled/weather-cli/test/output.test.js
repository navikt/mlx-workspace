import { expect } from 'chai';
import { formatWeather } from '../src/formatter.js';

describe('formatWeather', () => {
  const baseWeather = {
    temperature: 15,
    humidity: 70,
    windSpeed: 3.5,
    pressure: 1013,
    uvIndex: 2,
    cloudAreaFraction: 0
  };

  it('should format weather with all fields', () => {
    const output = formatWeather({ ...baseWeather, cloudAreaFraction: 0 }, 'Oslo');
    
    expect(output).to.include('Weather in Oslo (Met.no API)');
    expect(output).to.include('Temperature: 15°C');
    expect(output).to.include('Description: Clear');
    expect(output).to.include('Humidity: 70%');
    expect(output).to.include('Wind Speed: 3.5 m/s');
    expect(output).to.include('Pressure: 1013 hPa');
    expect(output).to.include('UV Index: 2');
  });

  describe('description derivation', () => {
    it('should return Clear for cloudAreaFraction <= 25%', () => {
      let output = formatWeather({ ...baseWeather, cloudAreaFraction: 0 }, 'Test');
      expect(output).to.include('Description: Clear');
      
      output = formatWeather({ ...baseWeather, cloudAreaFraction: 25 }, 'Test');
      expect(output).to.include('Description: Clear');
    });

    it('should return Mostly clear for cloudAreaFraction > 25%', () => {
      let output = formatWeather({ ...baseWeather, cloudAreaFraction: 26 }, 'Test');
      expect(output).to.include('Description: Mostly clear');
      
      output = formatWeather({ ...baseWeather, cloudAreaFraction: 50 }, 'Test');
      expect(output).to.include('Description: Mostly clear');
    });

    it('should return Partly cloudy for cloudAreaFraction > 50%', () => {
      let output = formatWeather({ ...baseWeather, cloudAreaFraction: 51 }, 'Test');
      expect(output).to.include('Description: Partly cloudy');
      
      output = formatWeather({ ...baseWeather, cloudAreaFraction: 75 }, 'Test');
      expect(output).to.include('Description: Partly cloudy');
    });

    it('should return Overcast for cloudAreaFraction > 75%', () => {
      let output = formatWeather({ ...baseWeather, cloudAreaFraction: 76 }, 'Test');
      expect(output).to.include('Description: Overcast');
      
      output = formatWeather({ ...baseWeather, cloudAreaFraction: 100 }, 'Test');
      expect(output).to.include('Description: Overcast');
    });
  });

  it('should handle decimal temperature', () => {
    const output = formatWeather({ ...baseWeather, temperature: 15.5 }, 'Oslo');
    expect(output).to.include('Temperature: 15.5°C');
  });

  it('should handle negative temperature', () => {
    const output = formatWeather({ ...baseWeather, temperature: -5 }, 'Oslo');
    expect(output).to.include('Temperature: -5°C');
  });

  it('should preserve location name from geocoding', () => {
    const output = formatWeather(baseWeather, 'Bergen, Norge');
    expect(output).to.include('Weather in Bergen, Norge (Met.no API)');
  });
});
