'use strict';

function parseLocation(args) {
  const tokens = args.join(' ').trim();
  if (!tokens) {
    throw new Error('Missing location argument');
  }
  const parts = tokens.split(/\s+/);
  if (parts.length === 2) {
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        throw new Error(`Coordinates out of range: lat ${lat}, lon ${lon}`);
      }
      return { type: 'coords', lat, lon, name: `${lat} ${lon}` };
    }
  }
  return { type: 'name', name: tokens };
}

module.exports = { parseLocation };
