export function formatWeather(locationName, w) {
  return [
    `Weather in ${locationName} (Met.no API)`,
    `Temperature: ${w.temperature}°C`,
    `Description: ${w.description}`,
    `Humidity: ${w.humidity}%`,
    `Wind Speed: ${w.windSpeed} m/s`,
    `Pressure: ${w.pressure} hPa`,
    `UV Index: ${w.uvIndex}`,
  ].join('\n');
}
