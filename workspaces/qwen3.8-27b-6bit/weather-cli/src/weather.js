import axios from 'axios';

const MET_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const USER_AGENT = 'weather-cli/1.0 github.com/hans';

export function describeClouds(fraction) {
  if (fraction > 75) return 'Overcast';
  if (fraction > 50) return 'Partly cloudy';
  if (fraction > 25) return 'Mostly clear';
  return 'Clear';
}

export function toWeather(payload, now = new Date()) {
  const series = payload?.properties?.timeseries;
  if (!Array.isArray(series) || series.length === 0) {
    throw new Error('No timeseries in weather response');
  }
  const nowMs = now.getTime();
  let closest = series[0];
  let best = Infinity;
  for (const entry of series) {
    const diff = Math.abs(new Date(entry.time).getTime() - nowMs);
    if (diff < best) {
      best = diff;
      closest = entry;
    }
  }
  const d = closest?.data?.instant?.details;
  if (!d) {
    throw new Error('No instant details in weather response');
  }
  return {
    temperature: d.air_temperature,
    description: describeClouds(d.cloud_area_fraction),
    humidity: d.relative_humidity,
    windSpeed: d.wind_speed,
    pressure: d.air_pressure_at_sea_level,
    uvIndex: d.ultraviolet_index_clear_sky,
  };
}

export function fetchWeather(lat, lon, http = axios.get) {
  return http(MET_URL, {
    params: { lat, lon },
    headers: { 'User-Agent': USER_AGENT },
  }).then((res) => toWeather(res.data));
}
