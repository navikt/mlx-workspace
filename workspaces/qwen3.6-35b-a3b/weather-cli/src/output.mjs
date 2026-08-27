/**
 * Format weather data into the spec's output template.
 * Null fields are replaced with "N/A".
 */

/**
 * Format weather data for console output.
 * @param {object} params
 * @param {string} params.locationName - Location name
 * @param {number|null} params.temperature - Temperature in °C
 * @param {string|null} params.description - Weather description
 * @param {number|null} params.humidity - Humidity percentage
 * @param {number|null} params.windSpeed - Wind speed in m/s
 * @param {number|null} params.pressure - Pressure in hPa
 * @param {number|null} params.uvIndex - UV index
 * @returns {string} Formatted output string
 */
export function formatWeather({
  locationName,
  temperature,
  description,
  humidity,
  windSpeed,
  pressure,
  uvIndex,
}) {
  const lines = [`Weather in ${locationName} (Met.no API)`];

  lines.push(`Temperature: ${formatValue(temperature, "°C")}°C`);
  lines.push(`Description: ${description || "N/A"}`);
  lines.push(`Humidity: ${formatValue(humidity, "%")}%`);
  lines.push(`Wind Speed: ${formatValue(windSpeed, "m/s")} m/s`);
  lines.push(`Pressure: ${formatValue(pressure, "hPa")} hPa`);
  lines.push(`UV Index: ${formatValue(uvIndex)}`);

  return lines.join("\n");
}

/**
 * Format a value or return "N/A" for null/undefined.
 * @param {number|null} value
 * @param {string} [unit]
 * @returns {string}
 */
function formatValue(value, unit) {
  if (value === null || value === undefined) {
    return "N/A";
  }
  return String(value);
}
