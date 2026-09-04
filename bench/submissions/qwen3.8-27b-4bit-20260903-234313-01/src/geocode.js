import axios from 'axios';

export const GEO_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';
export const USER_AGENT = `weather-cli/1.0 https://github.com/yourname/weather-cli`;

export async function geocode(name, { axiosInstance = axios } = {}) {
  const res = await axiosInstance.get(GEO_URL, {
    params: { sok: name, fuzzy: true, treffPerSide: 1, utkoordsys: 4258 },
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  const navn = res.data?.navn;
  if (!Array.isArray(navn) || navn.length === 0) {
    throw new Error(`geocoding failed: no match for "${name}"`);
  }
  const first = navn[0];
  const coords = first?.geojson?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new Error(`geocoding failed: no coordinates for "${name}"`);
  }
  // Geonorge returns GeoJSON [lon, lat] — swap to [lat, lon]
  const [lon, lat] = coords;
  const displayName = first?.stedsnavn?.[0]?.skrivemåte ?? name;
  return { lat, lon, name: displayName };
}
