import axios from 'axios';
import { USER_AGENT } from './geocode.js';

const MET_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';

export function closestEntry(timeseries, now = Date.now()) {
  let best = null;
  let bestDiff = Infinity;
  for (const entry of timeseries) {
    const diff = Math.abs(Date.parse(entry.time) - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  return best;
}

export async function fetchWeather(lat, lon, http = axios) {
  const { data } = await http.get(MET_URL, {
    params: { lat, lon },
    headers: { 'User-Agent': USER_AGENT },
  });
  const entry = closestEntry(data?.properties?.timeseries ?? []);
  if (!entry) throw new Error('No timeseries data returned');
  return entry.data.instant.details;
}
