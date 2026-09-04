/**
 * Format and output weather data according to spec.
 */
export function formatWeather(locationName, weather) {
  const lines = [
    `Weather in ${locationName} (Met.no API)`,
    `Temperature: ${weather.temperature}°C`,
    `Description: ${weather.description}`,
    `Humidity: ${weather.humidity}%`,
    `Wind Speed: ${weather.windSpeed} m/s`,
    `Pressure: ${weather.pressure} hPa`,
    `UV Index: ${weather.uvIndex}`
  ];
  return lines.join('\n');
}

export function output(locationName, weather) {
  console.log(formatWeather(locationName, weather));
}
