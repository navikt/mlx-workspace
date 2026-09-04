export function describeClouds(cloudAreaFraction) {
  if (typeof cloudAreaFraction !== "number" || Number.isNaN(cloudAreaFraction)) {
    return "Unknown";
  }
  if (cloudAreaFraction > 75) return "Overcast";
  if (cloudAreaFraction > 50) return "Partly cloudy";
  if (cloudAreaFraction > 25) return "Mostly clear";
  return "Clear";
}

export function formatWeather(locationName, { entry, units }) {
  const d = entry?.data?.instant?.details ?? {};
  const lines = [
    `Weather in ${locationName} (Met.no API)`,
    `Temperature: ${d.air_temperature}°C`,
    `Description: ${describeClouds(d.cloud_area_fraction)}`,
    `Humidity: ${d.relative_humidity}%`,
    `Wind Speed: ${d.wind_speed} m/s`,
    `Pressure: ${d.air_pressure_at_sea_level} hPa`,
    `UV Index: ${d.ultraviolet_index_clear_sky}`,
  ];
  return lines.join("\n");
}
