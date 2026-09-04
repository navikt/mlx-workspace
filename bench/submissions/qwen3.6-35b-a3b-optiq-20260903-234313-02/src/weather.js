import axios from 'axios';

const MET_NO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const HEADERS = {
  'User-Agent': 'weather-cli/1.0 github.com/weather-cli',
  'Accept': 'application/json'
};

/**
 * Derive weather description from cloud_area_fraction.
 */
function getDescription(cloudAreaFraction) {
  if (cloudAreaFraction > 75) return 'Overcast';
  if (cloudAreaFraction > 50) return 'Partly cloudy';
  if (cloudAreaFraction > 25) return 'Mostly clear';
  return 'Clear';
}

/**
 * Find the closest timeseries entry to the current time.
 * Timeseries is sorted chronologically ascending.
 */
function findClosestEntry(timeseries) {
  const now = Date.now();
  let closest = timeseries[0];
  let closestDiff = Math.abs(new Date(timeseries[0].time).getTime() - now);

  for (let i = 1; i < timeseries.length; i++) {
    const diff = Math.abs(new Date(timeseries[i].time).getTime() - now);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = timeseries[i];
    }
  }

  return closest;
}

/**
 * Fetch weather data from Met.no API.
 * Returns weather data object with all required fields.
 */
export async function fetchWeather(lat, lon) {
  const params = { lat, lon };

  const response = await axios.get(MET_NO_URL, { params, headers: HEADERS });

  const data = response.data;
  const timeseries = data.properties.timeseries;

  if (!timeseries || timeseries.length === 0) {
    const err = new Error('No weather data available');
    err.code = 'NO_DATA';
    throw err;
  }

  const closest = findClosestEntry(timeseries);
  const instant = closest.data.instant;

  if (!instant || !instant.details) {
    const err = new Error('Weather data missing instant.details');
    err.code = 'INVALID_DATA';
    throw err;
  }

  const details = instant.details;

  return {
    temperature: details.air_temperature,
    description: getDescription(details.cloud_area_fraction),
    humidity: details.relative_humidity,
    windSpeed: details.wind_speed,
    pressure: details.air_pressure_at_sea_level,
    uvIndex: details.ultraviolet_index_clear_sky
  };
}
