import axios from 'axios';
import { USER_AGENT } from './geocode.js';

export const MET_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';

export function describeClouds(fraction) {
  if (fraction == null) return 'Unknown';
  if (fraction > 75) return 'Overcast';
  if (fraction > 50) return 'Partly cloudy';
  if (fraction > 25) return 'Mostly clear';
  return 'Clear';
}

export function closestEntry(timeseries, now = new Date()) {
  if (!Array.isArray(timeseries) || timeseries.length === 0) {
    throw new Error('no timeseries data');
  }
  const nowMs = now.getTime();
  let best = null;
  for (const entry of timeseries) {
    const t = Date.parse(entry.time);
    if (!Number.isFinite(t)) continue;
    const d = Math.abs(t - nowMs);
    if (best === null || d < best.d) best = { entry, d };
  }
  if (best === null) throw new Error('no valid timeseries entries');
  return best.entry;
}

export function extractWeather(entry) {
  const d = entry?.data?.instant?.details;
  if (!d) throw new Error('missing instant.details in timeseries entry');
  return {
    temperature: d.air_temperature,
    description: describeClouds(d.cloud_area_fraction),
    humidity: d.relative_humidity,
    windSpeed: d.wind_speed,
    pressure: d.air_pressure_at_sea_level,
    uvIndex: d.ultraviolet_index_clear_sky,
  };
}

export async function fetchWeather(lat, lon, { axiosInstance = axios } = {}) {
  const res = await axiosInstance.get(MET_URL, {
    params: { lat, lon },
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  const timeseries = res.data?.properties?.timeseries;
  const entry = closestEntry(timeseries);
  return extractWeather(entry);
}
