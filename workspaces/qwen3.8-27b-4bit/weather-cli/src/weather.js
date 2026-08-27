import axios from 'axios';
import { USER_AGENT } from './config.js';

const MET_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';

function describeCloud(fraction) {
  if (fraction > 75) return 'Overcast';
  if (fraction > 50) return 'Partly cloudy';
  if (fraction > 25) return 'Mostly clear';
  return 'Clear';
}

// (lat, lon) -> current-conditions object from the timeseries entry closest to now.
export async function fetchWeather(lat, lon, http = axios) {
  const url = `${MET_URL}?lat=${lat}&lon=${lon}`;
  let res;
  try {
    res = await http.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
    });
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) throw new Error('Met.no rejected the request (403) — set WEATHER_USER_AGENT to a real contact');
    if (status === 429) throw new Error('Met.no is throttling (429) — try again later');
    throw new Error(`Met.no request failed: ${err.message}`);
  }
  const series = res.data?.properties?.timeseries ?? [];
  if (series.length === 0) throw new Error('Met.no returned no timeseries data');
  const now = Date.now();
  let closest = series[0];
  let best = Infinity;
  for (const entry of series) {
    const d = Math.abs(Date.parse(entry.time) - now);
    if (d < best) { best = d; closest = entry; }
  }
  const det = closest.data?.instant?.details ?? {};
  return {
    temperature: det.air_temperature,
    description: describeCloud(det.cloud_area_fraction ?? 0),
    humidity: det.relative_humidity,
    windSpeed: det.wind_speed,
    pressure: det.air_pressure_at_sea_level,
    uvIndex: det.ultraviolet_index_clear_sky,
  };
}
