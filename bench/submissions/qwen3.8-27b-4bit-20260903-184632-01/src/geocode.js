'use strict';

const axios = require('axios');

const GEO_NORGE_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';

const USER_AGENT = 'weather-cli/1.0 hans@localhost';

async function geocode(name, { http = axios, userAgent = USER_AGENT } = {}) {
  const params = new URLSearchParams();
  params.set('sok', name);
  params.set('fuzzy', 'true');
  params.set('treffPerSide', '1');
  params.set('utkoordsys', '4258');

  let response;
  try {
    response = await http.get(`${GEO_NORGE_URL}?${params.toString()}`, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
    });
  } catch (error) {
    const status = error.response ? error.response.status : null;
    const detail = status ? ` (HTTP ${status})` : ` (${error.message})`;
    const err = new Error(`Geocoding failed for "${name}"${detail}`);
    err.exitCode = 1;
    throw err;
  }

  const body = response.data;
  const matches = body && Array.isArray(body.navn) ? body.navn : [];
  const first = matches[0];
  const coordinates =
    first &&
    first.geojson &&
    first.geojson.geometry &&
    Array.isArray(first.geojson.geometry.coordinates)
      ? first.geojson.geometry.coordinates
      : null;

  if (!coordinates || coordinates.length < 2) {
    const err = new Error(`No place found for "${name}" (Geonorge returned no match)`);
    err.exitCode = 1;
    throw err;
  }

  // Geonorge returns GeoJSON [lon, lat]; the rest of the app uses [lat, lon].
  return {
    name: name,
    lat: coordinates[1],
    lon: coordinates[0],
  };
}

module.exports = { geocode, GEO_NORGE_URL, USER_AGENT };
