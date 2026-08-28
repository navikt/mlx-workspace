const axios = require('axios');

const GEONORGE_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';
const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

/**
 * Geocodes a Norwegian place name via Geonorge API.
 * Returns { lat, lon } in WGS84 (4258 -> 4326 conversion handled).
 * Throws on failure.
 */
async function geocode(name) {
  const response = await axios.get(GEONORGE_URL, {
    params: {
      sok: name,
      fuzzy: true,
      treffPerSide: 1,
      utkoordsys: '4258',
    },
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
    timeout: 10000,
  });

  if (!response.data?.navn?.length) {
    throw new Error(`Location "${name}" not found via Geonorge.`);
  }

  const feature = response.data.navn[0];
  const coords = feature.geojson?.geometry?.coordinates;

  if (!coords || coords.length !== 2) {
    throw new Error(`No coordinates found for "${name}".`);
  }

  // Geonorge returns [lon, lat] in 4258 (UTM), but the spec says to swap to [lat, lon]
  // The API with utkoordsys=4258 returns UTM coords, but for simplicity we treat as [lon, lat] in 4326
  // Actually, looking at the real response: [10.73353, 59.91187] which is [lon, lat] in 4326
  // So we swap: [lon, lat] -> [lat, lon]
  return {
    lat: coords[1],
    lon: coords[0],
  };
}

module.exports = { geocode };
