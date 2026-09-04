'use strict';

function parseCoordinates(arg) {
  const parts = arg.trim().split(/\s+/);
  if (parts.length !== 2) {
    throw new Error(`Invalid coordinates: "${arg}" (expected "lat lon")`);
  }
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`Invalid coordinates: "${arg}"`);
  }
  if (lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude: ${lat} (must be between -90 and 90)`);
  }
  if (lon < -180 || lon > 180) {
    throw new Error(`Invalid longitude: ${lon} (must be between -180 and 180)`);
  }
  return { lat, lon, name: `${lat}, ${lon}` };
}

function parseLocation(arg) {
  if (arg === undefined || arg.trim() === '') {
    throw new Error('No location provided');
  }
  const trimmed = arg.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 2) {
    if (parts.every((p) => /^-?\d+(\.\d+)?$/.test(p))) {
      return parseCoordinates(trimmed);
    }
    // Two tokens that are not both numeric cannot be coordinates.
    throw new Error(`Invalid coordinates: "${trimmed}" (expected "lat lon")`);
  }
  return { name: trimmed };
}

module.exports = { parseLocation, parseCoordinates };
