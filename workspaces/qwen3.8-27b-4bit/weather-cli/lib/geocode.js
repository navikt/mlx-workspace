import axios from 'axios';

const GEONORGE_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';

export const USER_AGENT = 'weather-cli/1.0 https://github.com/yourname/weather-cli';

export async function geocode(name, { userAgent = USER_AGENT, http = axios } = {}) {
  const { data } = await http.get(GEONORGE_URL, {
    params: { sok: name, fuzzy: true, treffPerSide: 1, utkoordsys: 4326 },
    headers: { 'User-Agent': userAgent, Accept: 'application/json' },
  });

  const match = data?.navn?.[0];
  const coords = match?.geojson?.geometry?.coordinates;
  if (!match || !coords || coords.length < 2) {
    throw new Error(`No place found for "${name}"`);
  }
  const [lon, lat] = coords;
  const displayName = pickDisplayName(match, name);
  return { type: 'coords', lat, lon, displayName };
}

function pickDisplayName(match, fallback) {
  const names = match.stedsnavn ?? [];
  const primary = names.find((n) => n.navnestatus === 'hovednavn' && n.språk === 'Norsk') ?? names[0];
  let displayName = primary?.skrivemåte ?? fallback;
  const type = match.navneobjekttype;
  if (type && displayName.toLowerCase().endsWith(` ${type.toLowerCase()}`)) {
    displayName = displayName.slice(0, -(type.length + 1));
  }
  return displayName || fallback;
}
