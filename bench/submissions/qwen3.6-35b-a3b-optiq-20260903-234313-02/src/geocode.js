import axios from 'axios';

const GEONORGE_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';
const HEADERS = {
  'User-Agent': 'weather-cli/1.0 github.com/weather-cli',
  'Accept': 'application/json'
};

/**
 * Geocode a Norwegian place name via Geonorge API.
 * Returns { lat, lon, placeName }
 */
export async function geocode(name) {
  const params = {
    sok: name,
    fuzzy: true,
    treffPerSide: 1,
    utkoordsys: '4258'
  };

  const response = await axios.get(GEONORGE_URL, { params, headers: HEADERS });

  if (!response.data.navn || response.data.navn.length === 0) {
    const err = new Error(`Location not found: ${name}`);
    err.code = 'LOCATION_NOT_FOUND';
    throw err;
  }

  const place = response.data.navn[0];
  const coordinates = place.geojson.geometry.coordinates;
  // GeoJSON is [lon, lat], swap to [lat, lon]
  const lat = coordinates[1];
  const lon = coordinates[0];

  // Extract place name from stedsnavn entries — use the shorter skrivemåte
  const navneEntries = place.stedsnavn || [];
  let placeName = place.stedsnummer.toString();
  if (navneEntries.length > 0) {
    // Find the entry with shorter skrivemåte (e.g. "Oslo" vs "Oslo fylke")
    let shortest = navneEntries[0];
    for (const entry of navneEntries) {
      if (entry.skrivemåte.length < shortest.skrivemåte.length) {
        shortest = entry;
      }
    }
    placeName = shortest.skrivemåte;
  }

  return { lat, lon, placeName };
}
