import axios from 'axios';

const GEONORGE_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';
const USER_AGENT = 'weather-cli/1.0 (test@weather-cli.dev)';

export async function geocode(name) {
  const encodedName = encodeURIComponent(name);
  const url = `${GEONORGE_URL}?sok=${encodedName}&fuzzy=true&treffPerSide=1&utkoordsys=4258`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    const data = response.data;

    if (!data.navn || data.navn.length === 0) {
      throw new Error(`No location found for "${name}"`);
    }

    const place = data.navn[0];
    const coordinates = place.geojson.geometry.coordinates;
    const lon = coordinates[0];
    const lat = coordinates[1];

    const displayName = place.stedsnavn[0] ? place.stedsnavn[0].skrivemåte : place.navneobjekttype;

    return { lat, lon, displayName };
  } catch (error) {
    if (error.response) {
      throw new Error(`Geonorge API error: ${error.response.status} ${error.response.statusText}`);
    }
    throw new Error(`Geocoding failed: ${error.message}`);
  }
}
