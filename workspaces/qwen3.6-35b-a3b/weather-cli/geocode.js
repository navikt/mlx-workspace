import axios from 'axios';

const GEONORGE_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';
const USER_AGENT = 'weather-cli/1.0 github.com/weather-cli';

export async function geocode(name) {
  const url = new URL(GEONORGE_URL);
  url.searchParams.set('sok', name);
  url.searchParams.set('fuzzy', 'true');
  url.searchParams.set('treffPerSide', '1');
  url.searchParams.set('utkoordsys', '4326');

  const res = await axios.get(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
    timeout: 10000,
  });

  const navn = res.data?.navn;
  if (!navn || navn.length === 0) {
    throw new Error(`No location found for "${name}"`);
  }

  const first = navn[0];
  const coords = first.geojson?.geometry?.coordinates;
  if (!coords || coords.length < 2) {
    throw new Error(`No coordinates found for "${name}"`);
  }

  // Geonorge with utkoordsys=4326 returns [lon, lat]
  const lon = coords[0];
  const lat = coords[1];

  // Get the primary name from stedsnavn
  const stedsnavn = first.stedsnavn;
  let locationName = name;
  if (stedsnavn && stedsnavn.length > 0) {
    // Prefer the first entry (main name)
    locationName = stedsnavn[0].skrivemate || name;
  }

  return { lat, lon, name: locationName };
}
