const GEO_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';

export async function geocode(name, { http = fetchJson, userAgent = USER_AGENT } = {}) {
  const url = `${GEO_URL}?sok=${encodeURIComponent(name)}&fuzzy=true&treffPerSide=1&utkoordsys=4258`;
  const res = await http(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  const body = res.data;
  const hit = Array.isArray(body?.navn) ? body.navn[0] : undefined;
  const coords = hit?.geojson?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new Error(`Could not geocode "${name}" (no Norwegian place found)`);
  }
  return { name: name, lat: coords[1], lon: coords[0] };
}

export const USER_AGENT = 'weather-cli/1.0 github.com/hans/weather-cli';

async function fetchJson(url, config = {}) {
  const { default: axios } = await import('axios');
  const res = await axios.get(url, config);
  return res;
}
