'use strict';

const axios = require('axios');

const GEONORGE_URL = 'https://ws.geonorge.no/stedsnavn/v1/sted';
const USER_AGENT = 'weather-cli/1.0 https://github.com/hans/weather-cli';

async function geocode(name, { http = axios } = {}) {
  const { data } = await http.get(GEONORGE_URL, {
    params: { sok: name, fuzzy: true, treffPerSide: 1, utkoordsys: 4258 },
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    timeout: 10000,
  });
  const match = (data && data.navn || [])[0];
  if (!match || !match.representasjonspunkt) {
    throw new Error(`Geocoding failed: no match for "${name}"`);
  }
  const primary =
    (match.stedsnavn || []).find((s) => s.navnestatus === 'hovednavn') ||
    (match.stedsnavn || [])[0];
  return {
    name: primary ? primary.skrivemåte : name,
    lat: match.representasjonspunkt.nord,
    lon: match.representasjonspunkt.øst,
  };
}

module.exports = { geocode, GEONORGE_URL, USER_AGENT };
