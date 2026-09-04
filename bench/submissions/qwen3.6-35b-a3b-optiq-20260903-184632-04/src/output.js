import { deriveDescription } from './description.js';

export function formatOutput(locationName, closestTimeseries) {
  const instant = closestTimeseries.instant || {};
  const details = instant.details || {};

  const temperature = details.temperature !== undefined && details.temperature !== null
    ? details.temperature
    : 'N/A';

  const description = deriveDescription(instant);

  const humidity = details.relative_humidity !== undefined && details.relative_humidity !== null
    ? details.relative_humidity
    : 'N/A';

  const windSpeed = details.wind_speed !== undefined && details.wind_speed !== null
    ? details.wind_speed
    : 'N/A';

  const pressure = details.air_pressure_at_sea_level !== undefined && details.air_pressure_at_sea_level !== null
    ? details.air_pressure_at_sea_level
    : 'N/A';

  const uvIndex = details.ultraviolet_index_clear_sky !== undefined && details.ultraviolet_index_clear_sky !== null
    ? details.ultraviolet_index_clear_sky
    : 'N/A';

  const output = [
    `Weather in ${locationName} (Met.no API)`,
    `Temperature: ${temperature}°C`,
    `Description: ${description}`,
    `Humidity: ${humidity}%`,
    `Wind Speed: ${windSpeed} m/s`,
    `Pressure: ${pressure} hPa`,
    `UV Index: ${uvIndex}`,
  ].join('\n');

  return output;
}
