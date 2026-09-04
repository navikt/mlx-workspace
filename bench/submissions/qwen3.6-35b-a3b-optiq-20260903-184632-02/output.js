/**
 * Derive a weather description from cloud_area_fraction.
 *
 * Rules (trap #2: boundary at exactly 75 uses >=):
 *   >= 75  → Overcast
 *   > 50   → Partly cloudy
 *   > 25   → Mostly clear
 *   else   → Clear
 *
 * @param {number|null} cloudAreaFraction
 * @returns {string}
 */
export function getDescription(cloudAreaFraction) {
  if (cloudAreaFraction === null || cloudAreaFraction === undefined) {
    return 'N/A';
  }

  if (cloudAreaFraction >= 75) {
    return 'Overcast';
  }
  if (cloudAreaFraction > 50) {
    return 'Partly cloudy';
  }
  if (cloudAreaFraction > 25) {
    return 'Mostly clear';
  }
  return 'Clear';
}

/**
 * Format weather data into the output string.
 *
 * @param {{ temperature: number, humidity: number, windSpeed: number, pressure: number, uvIndex: number|null, cloudAreaFraction: number|null, time: string }} weather
 * @param {string} locationName
 * @returns {string}
 */
export function formatWeather(weather, locationName) {
  const description = getDescription(weather.cloudAreaFraction);

  const uvLine = weather.uvIndex !== null && weather.uvIndex !== undefined
    ? `UV Index: ${weather.uvIndex}`
    : 'UV Index: N/A';

  return [
    `Weather in ${locationName} (Met.no API)`,
    `Temperature: ${weather.temperature}°C`,
    `Description: ${description}`,
    `Humidity: ${weather.humidity}%`,
    `Wind Speed: ${weather.windSpeed} m/s`,
    `Pressure: ${weather.pressure} hPa`,
    uvLine,
  ].join('\n');
}
