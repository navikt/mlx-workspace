import axios from 'axios';

const GEO_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';
const USER_AGENT = 'weather-cli/1.0 github.com/hans';

export function toPlace(payload, name) {
  const hit = payload?.navn?.[0];
  if (!hit) {
    throw new Error(`Location not found: ${name}`);
  }
  const names = (hit.stedsnavn ?? []).map((s) => s.skrivemåte).filter(Boolean);
  const placeName = names.sort((a, b) => a.length - b.length)[0] ?? name;
  const coords = hit.geojson?.geometry?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    return { name: placeName, lat: coords[1], lon: coords[0] };
  }
  const rep = hit.representasjonspunkt;
  if (rep && Number.isFinite(rep.nord) && Number.isFinite(rep.øst)) {
    return { name: placeName, lat: rep.nord, lon: rep.øst };
  }
  throw new Error(`No coordinates for location: ${name}`);
}

export function geocode(name, http = axios.get) {
  return http(GEO_URL, {
    params: { sok: name, fuzzy: true, treffPerSide: 1, utkoordsys: 4258 },
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  }).then((res) => toPlace(res.data, name));
}
