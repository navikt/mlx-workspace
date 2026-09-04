import axios from "axios";

const METNO_URL = "https://api.met.no/weatherapi/locationforecast/2.0/complete";

export function buildWeatherUrl(lat, lon, base = METNO_URL) {
  const url = new URL(base);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  return url.toString();
}

export function findClosestEntry(timeseries, now = new Date()) {
  if (!Array.isArray(timeseries) || timeseries.length === 0) {
    throw new Error("weather data: empty timeseries");
  }
  let best = timeseries[0];
  let bestDiff = Infinity;
  for (const entry of timeseries) {
    const t = new Date(entry.time);
    if (Number.isNaN(t.getTime())) continue;
    const diff = Math.abs(t.getTime() - now.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  return best;
}

export async function fetchWeather({ lat, lon }, { http = axios, base = METNO_URL, headers = {} } = {}) {
  const url = buildWeatherUrl(lat, lon, base);
  let res;
  try {
    res = await http.get(url, { headers: { ...headers } });
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) {
      throw new Error(
        "weather API rejected the request (HTTP 403): Met.no requires a User-Agent identifying the app with a real contact address"
      );
    }
    if (status === 429) {
      throw new Error("weather API rate limit exceeded (HTTP 429): try again later");
    }
    throw new Error(`weather API request failed${status ? ` (HTTP ${status})` : ""}: ${err.message}`);
  }
  const timeseries = res.data?.properties?.timeseries;
  const entry = findClosestEntry(timeseries, new Date());
  return {
    entry,
    units: res.data?.properties?.meta?.units ?? {},
    updatedAt: res.data?.properties?.meta?.updated_at,
  };
}
