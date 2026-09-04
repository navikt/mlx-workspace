import axios from 'axios';

const GEONORGE_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';
const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

/**
 * Geocode a Norwegian place name using Geonorge.
 * Returns { lon, lat } from GeoJSON coordinates.
 *
 * @param {string} name
 * @returns {{ lon: number, lat: number, displayName: string }}
 * @throws {Error} on geocoding failure
 */
export async function geocodeGeonorge(name) {
  const params = {
    sok: name,
    fuzzy: true,
    treffPerSide: 1,
    utkoordsys: '4258',
  };

  try {
    const response = await axios.get(GEONORGE_URL, {
      params,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    const data = response.data;

    if (!data.navn || data.navn.length === 0) {
      throw new Error(`No results found for "${name}"`);
    }

    const first = data.navn[0];
    const coords = first.geojson?.geometry?.coordinates;

    if (!coords || coords.length < 2) {
      throw new Error(`No coordinates found for "${name}"`);
    }

    // GeoJSON is [lon, lat]
    const lon = coords[0];
    const lat = coords[1];

    // Get display name from stedsnavn entries
    // Property name contains Norwegian character: skrivemåte
    const displayName = first.stedsnavn && first.stedsnavn.length > 0
      ? first.stedsnavn[0]['skrivemåte']
      : name;

    return { lon, lat, displayName };
  } catch (error) {
    if (error.response) {
      throw new Error(`Geonorge API error (${error.response.status}): ${error.response.statusText}`);
    }
    throw new Error(`Geonorge request failed: ${error.message}`);
  }
}
