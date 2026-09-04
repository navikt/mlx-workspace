const COORD_RE = /^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/;

export function parseLocation(arg) {
  if (arg === undefined || arg === null || String(arg).trim() === '') {
    throw new Error('location required: pass a place name or "lat lon"');
  }
  // Collapse any internal whitespace so multi-token input like "59.91 10.75"
  // (joined from argv) is handled uniformly.
  const s0 = String(arg).replace(/\s+/g, ' ').trim();
  const m = s0.match(COORD_RE);
  if (m) {
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error(`invalid latitude: ${m[1]}`);
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new Error(`invalid longitude: ${m[2]}`);
    }
    return { type: 'coords', lat, lon, name: `${lat} ${lon}` };
  }
  return { type: 'name', name: s0 };
}
