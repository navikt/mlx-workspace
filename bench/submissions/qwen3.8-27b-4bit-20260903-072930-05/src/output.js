import { describeClouds } from './describe.js';

export function formatWeather({ locationName, details, hasUv, uv }) {
  const lines = [
    `Weather in ${locationName} (Met.no API)`,
    `Temperature: ${details.air_temperature}°C`,
    `Description: ${describeClouds(details.cloud_area_fraction)}`,
    `Humidity: ${details.relative_humidity}%`,
    `Wind Speed: ${details.wind_speed} m/s`,
    `Pressure: ${details.air_pressure_at_sea_level} hPa`,
  ];
  if (hasUv) {
    lines.push(`UV Index: ${uv}`);
  }
  return lines.join('\n');
}
