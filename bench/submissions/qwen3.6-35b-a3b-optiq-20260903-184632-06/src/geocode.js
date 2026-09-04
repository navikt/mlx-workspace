import axios from 'axios';

const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

export async function geocode(locationName) {
  const encoded = encodeURIComponent(locationName);
  const baseUrl = process.env.GEO_NORGE_BASE || 'https://ws.geonorge.no/stedsnavn/v1/sted';
  const url = `${baseUrl}?sok=${encoded}&fuzzy=true&treffPerSide=1&utkoordsys=4258`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });

  const navn = response.data.navn;
  if (!navn || navn.length === 0) {
    throw new Error(`Location not found: ${locationName}`);
  }

  const firstResult = navn[0];
  const coords = firstResult.geojson.geometry.coordinates;
  // GeoJSON returns [lon, lat], swap to [lat, lon]
  const lat = coords[1];
  const lon = coords[0];

  const navneObjekter = firstResult.stedsnavn;
  const name = navneObjekter && navneObjekter.length > 0
    ? navneObjekter[0].skrivemåte
    : locationName;

  return { lat, lon, name };
}
