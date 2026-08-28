/**
 * Formats weather data into the specified output format.
 * @param {Object} weather - Weather data from fetchWeather
 * @param {string} locationName - Name of the location
 * @param {string} [source='Met.no API'] - API source label
 * @returns {string} Formatted output string
 */
function formatOutput(weather, locationName, source = 'Met.no API') {
  const lines = [
    `Weather in ${locationName} (${source})`,
    `Temperature: ${weather.temperature}°C`,
    `Description: ${weather.description}`,
    `Humidity: ${weather.humidity}%`,
    `Wind Speed: ${weather.windSpeed} m/s`,
    `Pressure: ${weather.pressure} hPa`,
    `UV Index: ${weather.uvIndex}`,
  ];

  return lines.join('\n');
}

module.exports = { formatOutput };
