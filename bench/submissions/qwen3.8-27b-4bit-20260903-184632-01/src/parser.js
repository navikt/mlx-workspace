'use strict';

function isNumber(value) {
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
}

function parseArgs(argv) {
  const tokens = argv.filter((token) => token !== '');
  if (tokens.length === 0) {
    return { kind: 'none' };
  }
  if (tokens.length === 2 && isNumber(tokens[0]) && isNumber(tokens[1])) {
    const lat = Number(tokens[0]);
    const lon = Number(tokens[1]);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      const error = new Error(
        `Invalid coordinates: lat must be in [-90, 90] and lon in [-180, 180] (got lat=${lat}, lon=${lon})`
      );
      error.exitCode = 1;
      throw error;
    }
    return { kind: 'coords', lat, lon };
  }
  if (tokens.length === 1) {
    return { kind: 'name', name: tokens[0] };
  }
  const error = new Error(
    'Usage: weather [location] where location is a Norwegian place name or "lat lon"'
  );
  error.exitCode = 1;
  throw error;
}

module.exports = { parseArgs };
