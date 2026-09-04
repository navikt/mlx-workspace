'use strict';

const axios = require('axios');

const GEOFORSKNING_BASE = 'https://ws.geonorge.no/stedsnavn/v1/sted';

async function geocode(name, { userAgent, axiosInstance = axios } = {}) {
  const url = `${GEOFORSKNING_BASE}?sok=${encodeURIComponent(name)}&fuzzy=true&treffPerSide=1&utkoordsys=4258`;
  let res;
  try {
    res = await axiosInstance.get(url, {
      headers: {
        Accept: 'application/json',
        ...(userAgent ? { 'User-Agent': userAgent } : {}),
      },
      timeout: 15000,
    });
  } catch (err) {
    const status = err.response ? err.response.status : undefined;
    if (status === 404) {
      throw new Error(`Geocoding failed: no place found for "${name}"`);
    }
    if (err.response) {
      throw new Error(`Geocoding failed: HTTP ${status} from Geonorge`);
    }
    throw new Error(`Geocoding failed: ${err.message}`);
  }

  const hits = res.data && Array.isArray(res.data.navn) ? res.data.navn : [];
  const hit = hits[0];
  if (!hit) {
    throw new Error(`Geocoding failed: no place found for "${name}"`);
  }

  // Prefer the representation point (always a single lat/lon pair); fall back
  // to a GeoJSON Point geometry. Non-Point geometries (e.g. fjords, counties)
  // have no single point and cannot be used for a point weather forecast.
  let lat;
  let lon;
  if (hit.representasjonspunkt && Number.isFinite(hit.representasjonspunkt.nord) && Number.isFinite(hit.representasjonspunkt.øst)) {
    lat = hit.representasjonspunkt.nord;
    lon = hit.representasjonspunkt.øst;
  } else if (
    hit.geojson &&
    hit.geojson.geometry &&
    hit.geojson.geometry.type === 'Point' &&
    Array.isArray(hit.geojson.geometry.coordinates) &&
    hit.geojson.geometry.coordinates.length >= 2
  ) {
    // GeoJSON order is [lon, lat] — swap to lat/lon.
    [lon, lat] = hit.geojson.geometry.coordinates;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`Geocoding failed: no usable point coordinates for "${name}"`);
  }

  let displayName = name;
  if (Array.isArray(hit.stedsnavn) && hit.stedsnavn.length > 0) {
    const primary = hit.stedsnavn.find((n) => n.navnestatus === 'hovednavn') || hit.stedsnavn[0];
    if (primary && primary.skrivemaate) {
      displayName = primary.skrivemaate;
    }
  }

  return { lat, lon, name: displayName };
}

module.exports = { geocode, GEOFORSKNING_BASE };
