'use strict';

function describeCloudCover(cloudAreaFraction) {
  if (cloudAreaFraction > 75) {
    return 'Overcast';
  }
  if (cloudAreaFraction > 50) {
    return 'Partly cloudy';
  }
  if (cloudAreaFraction > 25) {
    return 'Mostly clear';
  }
  return 'Clear';
}

function formatWeather(locationName, details) {
  if (typeof details.cloud_area_fraction !== 'number') {
    const err = new Error('Weather data is missing cloud cover; cannot determine the description');
    err.exitCode = 1;
    throw err;
  }
  if (typeof details.ultraviolet_index_clear_sky !== 'number') {
    const err = new Error('Weather data is missing the UV index');
    err.exitCode = 1;
    throw err;
  }

  const lines = [
    `Weather in ${locationName} (Met.no API)`,
    `Temperature: ${details.air_temperature}\u00b0C`,
    `Description: ${describeCloudCover(details.cloud_area_fraction)}`,
    `Humidity: ${details.relative_humidity}%`,
    `Wind Speed: ${details.wind_speed} m/s`,
    `Pressure: ${details.air_pressure_at_sea_level} hPa`,
    `UV Index: ${details.ultraviolet_index_clear_sky}`,
  ];
  return lines.join('\n');
}

module.exports = { formatWeather, describeCloudCover };
