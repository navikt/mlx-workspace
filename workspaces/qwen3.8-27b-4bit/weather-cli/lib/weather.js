import axios from 'axios';

const MET_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';

export const USER_AGENT = 'weather-cli/1.0 https://github.com/yourname/weather-cli';

export function describeCloudCover(fraction) {
  if (fraction > 75) return 'Overcast';
  if (fraction > 50) return 'Partly cloudy';
  if (fraction > 25) return 'Mostly clear';
  return 'Clear';
}

export function closestEntry(timeseries, now = new Date()) {
  let best = null;
  let bestDiff = Infinity;
  for (const entry of timeseries) {
    const diff = Math.abs(new Date(entry.time) - now);
    if (diff < bestDiff) {
      best = entry;
      bestDiff = diff;
    }
  }
  return best;
}

export function extractWeather(data, now = new Date()) {
  const timeseries = data?.properties?.timeseries ?? [];
  const entry = closestEntry(timeseries, now);
  const d = entry?.data?.instant?.details;
  if (!d) {
    throw new Error('No timeseries data in weather response');
  }
  return {
    temperature: d.air_temperature,
    description: describeCloudCover(d.cloud_area_fraction ?? 0),
    humidity: d.relative_humidity,
    windSpeed: d.wind_speed,
    pressure: d.air_pressure_at_sea_level,
    uvIndex: d.ultraviolet_index_clear_sky,
  };
}

export async function fetchWeather(lat, lon, { userAgent = USER_AGENT, http = axios, now = new Date() } = {}) {
  const { data } = await http.get(MET_URL, {
    params: { lat, lon },
    headers: { 'User-Agent': userAgent },
  });
  return extractWeather(data, now);
}
