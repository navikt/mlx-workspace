import axios from 'axios';
import { USER_AGENT } from './config.js';

const GEO_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';

// Geonorge place name -> { lat, lon, name }. Norway only.
export async function geocode(name, http = axios) {
  const url =
    `${GEO_URL}?sok=${encodeURIComponent(name)}` +
    '&fuzzy=true&treffPerSide=1&utkoordsys=4258';
  let res;
  try {
    res = await http.get(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      timeout: 10000,
    });
  } catch (err) {
    throw new Error(`Geocoding failed for "${name}": ${err.message}`);
  }
  const hits = res.data?.navn ?? [];
  if (hits.length === 0) {
    throw new Error(`No place found for "${name}" (Geonorge covers Norway only)`);
  }
  const hit = hits[0];
  // prefer representasjonspunkt (nord=lat, øst=lon); fall back to GeoJSON [lon, lat]
  const lat = hit.representasjonspunkt?.nord ?? hit.geojson?.geometry?.coordinates?.[1];
  const lon = hit.representasjonspunkt?.øst ?? hit.geojson?.geometry?.coordinates?.[0];
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    throw new Error(`Geocoding for "${name}" returned no coordinates`);
  }
  const displayName = hit.stedsnavn?.[0]?.skrivemåte ?? name;
  return { lat, lon, name: displayName };
}
