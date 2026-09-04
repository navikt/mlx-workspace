'use strict';

const axios = require('axios');

const METNO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const USER_AGENT = 'weather-cli/1.0 https://github.com/hans/weather-cli';

async function fetchWeather(lat, lon, { http = axios } = {}) {
  const { data } = await http.get(METNO_URL, {
    params: { lat, lon },
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    timeout: 10000,
  });
  return data;
}

function closestEntry(timeseries, now = new Date()) {
  if (!Array.isArray(timeseries) || timeseries.length === 0) {
    throw new Error('No timeseries data in forecast response');
  }
  const target = now.getTime();
  let best = timeseries[0];
  let bestDiff = Infinity;
  for (const entry of timeseries) {
    const diff = Math.abs(new Date(entry.time).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  return best;
}

function deriveDescription(cloudAreaFraction) {
  if (cloudAreaFraction > 75) return 'Overcast';
  if (cloudAreaFraction > 50) return 'Partly cloudy';
  if (cloudAreaFraction > 25) return 'Mostly clear';
  return 'Clear';
}

function extractWeather(data, now = new Date()) {
  const entry = closestEntry(data.properties.timeseries, now);
  const d = entry.data.instant.details;
  return {
    temperature: d.air_temperature,
    description: deriveDescription(d.cloud_area_fraction),
    humidity: d.relative_humidity,
    windSpeed: d.wind_speed,
    pressure: d.air_pressure_at_sea_level,
    uvIndex: d.ultraviolet_index_clear_sky,
  };
}

module.exports = { fetchWeather, closestEntry, deriveDescription, extractWeather, METNO_URL, USER_AGENT };
