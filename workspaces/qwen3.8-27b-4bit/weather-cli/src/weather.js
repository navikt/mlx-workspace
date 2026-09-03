"use strict";

const axios = require("axios");

const METNO_URL =
  "https://api.met.no/weatherapi/locationforecast/2.0/complete";

class WeatherError extends Error {
  constructor(message, { status, retryable } = {}) {
    super(message);
    this.name = "WeatherError";
    this.status = status;
    this.retryable = Boolean(retryable);
  }
}

/**
 * Fetch the full Met.no forecast for a coordinate.
 * Returns the raw response body (the GeoJSON Feature).
 * Throws WeatherError on HTTP/network failure. 403 and 429 are marked
 * distinctly: 429 is retryable (throttling), 403 is a hard ToS block.
 */
async function fetchForecast(lat, lon, { userAgent, http } = {}) {
  const client = http || axios;
  const url = `${METNO_URL}?lat=${lat}&lon=${lon}`;

  let res;
  try {
    res = await client.get(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent,
      },
      timeout: 15000,
    });
  } catch (err) {
    const status = err.response ? err.response.status : undefined;
    const retryable = status === 429;
    const detail = status
      ? `HTTP ${status}`
      : err.code
        ? err.code
        : err.message;
    throw new WeatherError(`Met.no request failed: ${detail}`, {
      status,
      retryable,
    });
  }

  return res.data;
}

/**
 * Pick the timeseries entry closest to `now` (a Date). All comparison is done
 * in UTC via epoch milliseconds, independent of the host's timezone.
 */
function closestEntry(timeseries, now = new Date()) {
  if (!Array.isArray(timeseries) || timeseries.length === 0) {
    throw new WeatherError("Forecast has no timeseries entries");
  }
  const nowMs = now.getTime();
  let best = timeseries[0];
  let bestDiff = Infinity;
  for (const entry of timeseries) {
    const t = Date.parse(entry.time);
    if (Number.isNaN(t)) continue;
    const diff = Math.abs(t - nowMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  return best;
}

/**
 * Extract the instant details from a timeseries entry.
 */
function extractDetails(entry) {
  const details =
    entry && entry.data && entry.data.instant && entry.data.instant.details;
  if (!details) {
    throw new WeatherError("Forecast entry has no instant.details");
  }
  return details;
}

module.exports = {
  fetchForecast,
  closestEntry,
  extractDetails,
  WeatherError,
  METNO_URL,
};
