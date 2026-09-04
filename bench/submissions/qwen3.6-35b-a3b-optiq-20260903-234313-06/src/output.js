/**
 * Format weather data into the specified output format.
 */
export function formatWeather(locationName, weather) {
  const lines = [
    `Weather in ${locationName} (Met.no API)`,
    `Temperature: ${formatNumber(weather.temperature)}°C`,
    `Description: ${weather.description}`,
    `Humidity: ${formatNumber(weather.humidity)}%`,
    `Wind Speed: ${formatNumber(weather.windSpeed)} m/s`,
    `Pressure: ${formatNumber(weather.pressure)} hPa`,
    `UV Index: ${formatNumber(weather.uvIndex)}`,
  ];

  return lines.join('\n');
}

function formatNumber(value) {
  if (typeof value === 'number') {
    // Use 1 decimal place for consistency, remove trailing zero if it's a whole number
    const formatted = value.toFixed(1);
    // Keep the decimal for consistency with spec
    return formatted;
  }
  return value;
}
