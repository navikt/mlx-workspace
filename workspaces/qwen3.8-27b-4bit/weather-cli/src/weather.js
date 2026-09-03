export const USER_AGENT = 'weather-cli/1.0 github.com/hans/weather-cli';

export function pickEntry(timeseries, now = new Date()) {
  if (!Array.isArray(timeseries) || timeseries.length === 0) {
    throw new Error('Forecast payload has no timeseries entries');
  }
  const nowMs = now.getTime();
  let best = null;
  let bestDiff = Infinity;
  for (const entry of timeseries) {
    const t = Date.parse(entry.time);
    if (!Number.isFinite(t)) continue;
    const diff = Math.abs(t - nowMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  if (best === null) {
    throw new Error('Forecast payload has no parseable entry times');
  }
  return best;
}

export async function fetchWeather(lat, lon, { http = fetchJson, userAgent = USER_AGENT } = {}) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const res = await http(url, { headers: { 'User-Agent': userAgent } });
  const series = res.data?.properties?.timeseries;
  const entry = pickEntry(series);
  const details = entry.data?.instant?.details;
  if (!details) {
    throw new Error('Forecast entry has no instant.details');
  }
  if (!Number.isFinite(details.cloud_area_fraction)) {
    throw new Error('Forecast entry is missing cloud cover data');
  }
  return {
    entry,
    details,
    hasUv: Number.isFinite(details.ultraviolet_index_clear_sky),
    uv: details.ultraviolet_index_clear_sky,
  };
}

async function fetchJson(url, config = {}) {
  const { default: axios } = await import('axios');
  const res = await axios.get(url, config);
  return res;
}
