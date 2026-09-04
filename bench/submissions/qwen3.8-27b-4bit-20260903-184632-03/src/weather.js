'use strict';

const axios = require('axios');

const METNO_BASE = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, { headers, retries = 3, backoffMs = 1000, axiosInstance = axios }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await axiosInstance.get(url, { headers, timeout: 15000 });
      return res;
    } catch (err) {
      lastErr = err;
      const status = err.response ? err.response.status : undefined;
      // 403 is a hard rejection (e.g. User-Agent policy) — never retry it.
      if (status === 403) {
        throw new Error('Met.no rejected the request (HTTP 403): the User-Agent must identify the app with a real contact');
      }
      // Only 429 (throttling) or network-level errors are retryable.
      const retryable = status === 429 || status === undefined;
      if (!retryable || attempt === retries) {
        break;
      }
      await sleep(backoffMs * 2 ** attempt);
    }
  }
  const status = lastErr.response ? lastErr.response.status : undefined;
  if (status) {
    throw new Error(`Met.no API error: HTTP ${status}`);
  }
  throw new Error(`Met.no API error: ${lastErr.message}`);
}

function closestEntry(timeseries, now) {
  if (!Array.isArray(timeseries) || timeseries.length === 0) {
    throw new Error('Malformed Met.no response: missing timeseries');
  }
  const nowMs = now.getTime();
  let best = null;
  let bestDiff = Infinity;
  for (const entry of timeseries) {
    const t = Date.parse(entry.time);
    if (!Number.isFinite(t)) {
      continue;
    }
    const diff = Math.abs(t - nowMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  if (!best) {
    throw new Error('Malformed Met.no response: no usable timeseries entries');
  }
  return best;
}

function deriveDescription(cloudAreaFraction) {
  if (cloudAreaFraction > 75) return 'Overcast';
  if (cloudAreaFraction > 50) return 'Partly cloudy';
  if (cloudAreaFraction > 25) return 'Mostly clear';
  return 'Clear';
}

async function fetchWeather({ lat, lon, userAgent }, { axiosInstance, now = new Date() } = {}) {
  const url = `${METNO_BASE}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const res = await fetchWithRetry(url, {
    headers: { 'User-Agent': userAgent },
    axiosInstance,
  });

  const properties = res.data && res.data.properties;
  if (!properties || !Array.isArray(properties.timeseries)) {
    throw new Error('Malformed Met.no response: missing properties.timeseries');
  }

  const entry = closestEntry(properties.timeseries, now);
  const details = entry.data && entry.data.instant && entry.data.instant.details;
  if (!details) {
    throw new Error('Malformed Met.no response: missing instant details');
  }

  if (!Number.isFinite(details.air_temperature)) {
    throw new Error('Malformed Met.no response: missing air_temperature');
  }
  if (!Number.isFinite(details.relative_humidity)) {
    throw new Error('Malformed Met.no response: missing relative_humidity');
  }
  if (!Number.isFinite(details.wind_speed)) {
    throw new Error('Malformed Met.no response: missing wind_speed');
  }
  if (!Number.isFinite(details.air_pressure_at_sea_level)) {
    throw new Error('Malformed Met.no response: missing air_pressure_at_sea_level');
  }
  if (!Number.isFinite(details.cloud_area_fraction)) {
    throw new Error('Malformed Met.no response: missing cloud_area_fraction');
  }
  if (!Number.isFinite(details.ultraviolet_index_clear_sky)) {
    throw new Error('Malformed Met.no response: missing ultraviolet_index_clear_sky');
  }

  return {
    temperature: details.air_temperature,
    description: deriveDescription(details.cloud_area_fraction),
    humidity: details.relative_humidity,
    windSpeed: details.wind_speed,
    pressure: details.air_pressure_at_sea_level,
    uvIndex: details.ultraviolet_index_clear_sky,
    time: entry.time,
  };
}

module.exports = { fetchWeather, closestEntry, deriveDescription, METNO_BASE };
