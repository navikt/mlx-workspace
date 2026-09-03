"use strict";

const axios = require("axios");

const GEONORGE_URL =
  "https://ws.geonorge.no/stedsnavn/v1/sted";

class GeocodeError extends Error {
  constructor(message) {
    super(message);
    this.name = "GeocodeError";
  }
}

/**
 * Geocode a Norwegian place name via Geonorge.
 * Returns { lat, lon, name } using the first match's representasjonspunkt
 * (nord = latitude, øst = longitude).
 * Throws GeocodeError on network failure or zero matches.
 */
async function geocode(name, { userAgent, http } = {}) {
  const client = http || axios;
  const params = new URLSearchParams({
    sok: name,
    fuzzy: "true",
    treffPerSide: "1",
    utkoordsys: "4258",
  });

  let res;
  try {
    res = await client.get(`${GEONORGE_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        ...(userAgent ? { "User-Agent": userAgent } : {}),
      },
      timeout: 15000,
    });
  } catch (err) {
    throw new GeocodeError(
      `Geocoding request failed: ${err.response ? `HTTP ${err.response.status}` : err.message}`
    );
  }

  const navn = res.data && Array.isArray(res.data.navn) ? res.data.navn : [];
  if (navn.length === 0) {
    throw new GeocodeError(`No geocoding results for "${name}"`);
  }

  const first = navn[0];
  const rep = first.representasjonspunkt;
  if (!rep || rep.nord === undefined || rep.øst === undefined) {
    throw new GeocodeError(`Geocoding result for "${name}" has no coordinates`);
  }

  return {
    lat: rep.nord,
    lon: rep.øst,
    name: first.stedsnavn && first.stedsnavn[0] ? first.stedsnavn[0].skrivemåte : name,
  };
}

module.exports = { geocode, GeocodeError, GEONORGE_URL };
