const { formatWeather } = require('./output');

describe('formatWeather', () => {
  const location = 'Oslo';
  const baseData = {
    temperature: 10,
    humidity: 80,
    windSpeed: 5,
    pressure: 1013,
    uvIndex: 2,
    cloudAreaFraction: 0
  };

  test('formats weather correctly for Clear sky', () => {
    const result = formatWeather(location, { ...baseData, cloudAreaFraction: 10 });
    expect(result).toContain('Description: Clear');
    expect(result).toContain('Weather in Oslo (Met.no API)');
    expect(result).toContain('Temperature: 10°C');
  });

  test('formats weather correctly for Mostly clear', () => {
    const result = formatWeather(location, { ...baseData, cloudAreaFraction: 30 });
    expect(result).toContain('Description: Mostly clear');
  });

  test('formats weather correctly for Partly cloudy', () => {
    const result = formatWeather(location, { ...baseData, cloudAreaFraction: 60 });
    expect(result).toContain('Description: Partly cloudy');
  });

  test('formats weather correctly for Overcast', () => {
    const result = formatWeather(location, { ...baseData, cloudAreaFraction: 80 });
    expect(result).toContain('Description: Overcast');
  });
});
