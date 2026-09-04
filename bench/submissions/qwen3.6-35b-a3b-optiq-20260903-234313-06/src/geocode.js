import axios from 'axios';

const GEONORGE_API = 'https://ws.geonorge.no/stedsnavn/v1/sted';
const USER_AGENT = 'weather-cli/1.0 test@example.com';

/**
 * Geocode a Norwegian place name via Geonorge API.
 * Returns { lat, lon, name }.
 * Swaps GeoJSON [lon, lat] to [lat, lon] order.
 */
export async function geocode(name) {
  const url = `${GEONORGE_API}?sok=${encodeURIComponent(name)}&fuzzy=true&treffPerSide=1&utkoordsys=4258`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    const data = response.data;

    if (!data.navn || data.navn.length === 0) {
      throw new Error(`No location found for "${name}"`);
    }

    const place = data.navn[0];
    const coordinates = place.geojson.geometry.coordinates;
    // GeoJSON is [lon, lat], swap to [lat, lon]
    const lon = coordinates[0];
    const lat = coordinates[1];

    // Derive location name from the first name variant
    const locationName = place.stedsnavn && place.stedsnavn.length > 0
      ? place.stedsnavn[0].skrivemåte
      : place.stedsnavn?.[0]?.skrivemåte || name;

    return { lat, lon, name: locationName };
  } catch (error) {
    if (error.response) {
      throw new Error(`Geonorge API error: ${error.response.status} ${error.response.statusText}`);
    }
    throw new Error(`Geonorge API request failed: ${error.message}`);
  }
}
