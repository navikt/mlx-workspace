import axios from "axios";

const GEONORGE_URL = "https://ws.geonorge.no/stedsnavn/v1/sted";

export const GEOCODE_PARAMS = {
  fuzzy: "true",
  treffPerSide: "1",
  utkoordsys: "4258",
};

export function buildGeocodeUrl(name, base = GEONORGE_URL) {
  const url = new URL(base);
  url.searchParams.set("sok", name);
  for (const [k, v] of Object.entries(GEOCODE_PARAMS)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export async function geocode(name, { http = axios, base = GEONORGE_URL, headers = {} } = {}) {
  const url = buildGeocodeUrl(name, base);
  let res;
  try {
    res = await http.get(url, { headers: { Accept: "application/json", ...headers } });
  } catch (err) {
    const status = err.response?.status;
    throw new Error(`geocoding failed for "${name}"${status ? ` (HTTP ${status})` : ""}: ${err.message}`);
  }
  const body = res.data;
  if (!body?.navn || body.navn.length === 0 || (body.metadata?.totaltAntallTreff ?? 0) === 0) {
    throw new Error(`geocoding failed: no place found for "${name}" (Geonorge covers Norway only)`);
  }
  const entry = body.navn[0];
  const coords = entry.geojson?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new Error(`geocoding failed: no coordinates in result for "${name}"`);
  }
  // GeoJSON order is [lon, lat]
  const [lon, lat] = coords;
  const displayName = entry.stedsnavn?.[0]?.skrivemåte ?? name;
  return { name: displayName, lat, lon };
}
