export function formatOutput(locationName, data) {
  const lines = [];
  lines.push(`Weather in ${locationName} (Met.no API)`);
  lines.push(`Temperature: ${data.temperature}°C`);

  if (data.description !== undefined) {
    lines.push(`Description: ${data.description}`);
  }

  lines.push(`Humidity: ${data.humidity}%`);
  lines.push(`Wind Speed: ${data.windSpeed} m/s`);
  lines.push(`Pressure: ${data.pressure} hPa`);

  if (data.uvIndex !== undefined) {
    lines.push(`UV Index: ${data.uvIndex}`);
  }

  return lines.join('\n');
}
