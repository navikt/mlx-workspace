import axios from 'axios';

export const USER_AGENT = 'weather-cli/1.0 github.com/hans';

const GEO_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';

export async function geocode(name, http = axios) {
  const { data } = await http.get(GEO_URL, {
    params: { sok: name, fuzzy: true, treffPerSide: 1, utkoordsys: 4258 },
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  const hit = data?.navn?.[0];
  if (!hit) throw new Error(`Location not found: ${name}`);
  const [lon, lat] = hit.geojson.geometry.coordinates;
  const displayName = hit.stedsnavn?.[0]?.skrivemåte ?? name;
  return { lat, lon, name: displayName };
}
