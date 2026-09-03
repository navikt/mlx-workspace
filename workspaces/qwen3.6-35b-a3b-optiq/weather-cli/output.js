export function formatWeather(locationName, weather) {
  const lines = [];
  lines.push(`Weather in ${locationName} (Met.no API)`);
  lines.push(`Temperature: ${weather.temperature}°C`);
  lines.push(`Description: ${weather.description}`);
  lines.push(`Humidity: ${weather.humidity}%`);
  lines.push(`Wind Speed: ${weather.windSpeed} m/s`);
  lines.push(`Pressure: ${weather.pressure} hPa`);
  lines.push(`UV Index: ${weather.uvIndex}`);
  return lines.join('\n');
}
