"use strict";

const COORD_RE = /^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/;

class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Parse the single location argument.
 * Returns { kind: "coords", lat, lon, name } or { kind: "name", name }.
 * Throws ParseError for invalid coordinates.
 */
function parseLocation(arg) {
  if (arg === undefined || arg === null || arg.trim() === "") {
    throw new ParseError("No location provided");
  }

  const trimmed = arg.trim();
  const m = COORD_RE.exec(trimmed);
  if (m) {
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new ParseError(`Invalid coordinates: ${arg}`);
    }
    if (lat < -90 || lat > 90) {
      throw new ParseError(`Latitude out of range: ${lat}`);
    }
    if (lon < -180 || lon > 180) {
      throw new ParseError(`Longitude out of range: ${lon}`);
    }
    return { kind: "coords", lat, lon, name: `${lat} ${lon}` };
  }

  return { kind: "name", name: trimmed };
}

module.exports = { parseLocation, ParseError, COORD_RE };
