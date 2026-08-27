export function cloudDescription(fraction) {
  if (fraction > 75) return 'Overcast';
  if (fraction > 50) return 'Partly cloudy';
  if (fraction > 25) return 'Mostly clear';
  return 'Clear';
}

export function formatWeather(locationName, d) {
  return [
    `Weather in ${locationName} (Met.no API)`,
    `Temperature: ${d.air_temperature}°C`,
    `Description: ${cloudDescription(d.cloud_area_fraction)}`,
    `Humidity: ${d.relative_humidity}%`,
    `Wind Speed: ${d.wind_speed} m/s`,
    `Pressure: ${d.air_pressure_at_sea_level} hPa`,
    `UV Index: ${d.ultraviolet_index_clear_sky}`,
  ].join('\n');
}
