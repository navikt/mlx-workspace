/**
 * Derive weather description from cloud area fraction
 * @param {number} cloudAreaFraction - Cloud coverage as percentage (0-100)
 * @returns {string}
 */
function getDescription(cloudAreaFraction) {
  if (cloudAreaFraction > 75) {
    return 'Overcast';
  } else if (cloudAreaFraction > 50) {
    return 'Partly cloudy';
  } else if (cloudAreaFraction > 25) {
    return 'Mostly clear';
  } else {
    return 'Clear';
  }
}

/**
 * Format weather data for display
 * @param {Object} weather - Weather data
 * @param {string} locationName - Name of the location
 * @returns {string}
 */
export function formatWeather(weather, locationName) {
  const description = getDescription(weather.cloudAreaFraction);

  return `Weather in ${locationName} (Met.no API)
Temperature: ${weather.temperature}°C
Description: ${description}
Humidity: ${weather.humidity}%
Wind Speed: ${weather.windSpeed} m/s
Pressure: ${weather.pressure} hPa
UV Index: ${weather.uvIndex}`;
}
