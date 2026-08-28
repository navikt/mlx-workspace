const axios = require('axios');

const MET_NO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

/**
 * Fetches weather data from Met.no API.
 * Returns the closest timeseries entry's data.
 * Throws on API errors.
 */
async function fetchWeather(lat, lon) {
  const response = await axios.get(MET_NO_URL, {
    params: { lat, lon },
    headers: {
      'User-Agent': USER_AGENT,
    },
    timeout: 15000,
  });

  if (response.status !== 200) {
    throw new Error(`Met.no API returned status ${response.status}`);
  }

  const data = response.data;
  const timeseries = data?.properties?.timeseries;

  if (!timeseries || timeseries.length === 0) {
    throw new Error('No weather data available for the given location.');
  }

  // Find the closest timeseries entry to current time
  const now = new Date();
  let closest = timeseries[0];
  let closestDiff = Infinity;

  for (const entry of timeseries) {
    const entryTime = new Date(entry.startTime);
    const diff = Math.abs(entryTime - now);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = entry;
    }
  }

  const instant = closest.data?.instant;
  if (!instant) {
    throw new Error('No instant data available in weather response.');
  }

  const details = instant.details || {};

  return {
    temperature: details.air_pressure_at_sea_level ?? details.temperature,
    temperature: details.temperature,
    humidity: details.relative_humidity,
    windSpeed: details.wind_speed,
    pressure: details.air_pressure_at_sea_level,
    uvIndex: details.ultraviolet_index_total,
    cloudAreaFraction: details.cloud_area_fraction,
  };
}

/**
 * Derives weather description from cloud_area_fraction.
 * @param {number} cloudAreaFraction - Cloud coverage percentage (0-100)
 * @returns {string} Weather description
 */
function getDescription(cloudAreaFraction) {
  if (!cloudAreaFraction && cloudAreaFraction !== 0) {
    return 'Clear';
  }

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

module.exports = { fetchWeather, getDescription };
