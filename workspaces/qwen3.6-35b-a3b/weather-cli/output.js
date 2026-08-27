export function formatOutput(locationName, weather) {
  return [
    `Weather in ${locationName} (Met.no API)`,
    `Temperature: ${weather.temperature}°C`,
    `Description: ${weather.description}`,
    `Humidity: ${weather.humidity}%`,
    `Wind Speed: ${weather.windSpeed} m/s`,
    `Pressure: ${weather.pressure} hPa`,
    `UV Index: ${weather.uvIndex}`,
  ].join('\n');
}
