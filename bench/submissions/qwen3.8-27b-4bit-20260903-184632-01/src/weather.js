'use strict';

const axios = require('axios');

const MET_NO_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';

const USER_AGENT = 'weather-cli/1.0 hans@localhost';

function pickCurrentEntry(timeseries, now) {
  const nowMs = now.getTime();
  let best = null;
  for (const entry of timeseries) {
    const entryTime = new Date(entry.time).getTime();
    if (Number.isNaN(entryTime)) {
      continue;
    }
    if (entryTime <= nowMs && (best === null || entryTime > new Date(best.time).getTime())) {
      best = entry;
    }
  }
  if (best === null) {
    const err = new Error('Forecast does not cover the current time');
    err.exitCode = 1;
    throw err;
  }
  return best;
}

async function fetchWeather(lat, lon, { http = axios, userAgent = USER_AGENT, now = new Date() } = {}) {
  const params = new URLSearchParams();
  params.set('lat', String(lat));
  params.set('lon', String(lon));

  let response;
  try {
    response = await http.get(`${MET_NO_URL}?${params.toString()}`, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
    });
  } catch (error) {
    const status = error.response ? error.response.status : null;
    if (status === 403) {
      const err = new Error(
        'Met.no rejected the request (HTTP 403). The User-Agent must identify the app with a real contact; check the User-Agent configuration. This is a policy block, not rate limiting.'
      );
      err.exitCode = 1;
      err.status = 403;
      throw err;
    }
    const detail = status ? ` (HTTP ${status})` : ` (${error.message})`;
    const err = new Error(`Weather API request failed${detail}`);
    err.exitCode = 1;
    err.status = status;
    throw err;
  }

  const timeseries =
    response.data && response.data.properties && Array.isArray(response.data.properties.timeseries)
      ? response.data.properties.timeseries
      : null;
  if (!timeseries) {
    const err = new Error('Weather API response did not contain a timeseries');
    err.exitCode = 1;
    throw err;
  }

  const entry = pickCurrentEntry(timeseries, now);
  const details = entry && entry.data && entry.data.instant && entry.data.instant.details;
  if (!details) {
    const err = new Error('Weather API entry is missing instant.details');
    err.exitCode = 1;
    throw err;
  }

  return {
    time: entry.time,
    details,
    location: { lat, lon },
  };
}

module.exports = { fetchWeather, pickCurrentEntry, MET_NO_URL, USER_AGENT };
