export function parseArgs(argv) {
  if (argv.length === 0) {
    throw new Error('Usage: weather [location]');
  }
  const location = argv.join(' ').trim();
  const parts = location.split(/\s+/);
  if (parts.length === 2) {
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        throw new Error(`Invalid coordinates: ${location}`);
      }
      return { type: 'coords', lat, lon };
    }
  }
  return { type: 'name', name: location };
}
