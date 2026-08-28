export function parseLocation(arg) {
  if (arg === undefined || arg.trim() === '') {
    throw new Error('No location given. Usage: weather [location]  (name or "lat lon")');
  }
  const parts = arg.trim().split(/\s+/);
  if (parts.length === 2) {
    const [lat, lon] = parts.map(Number);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      throw new Error(`Invalid coordinates: "${arg}"`);
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error(`Invalid coordinates: lat must be in [-90, 90], lon in [-180, 180]`);
    }
    return { type: 'coords', lat, lon, displayName: `${lat} ${lon}` };
  }
  return { type: 'name', displayName: parts.join(' ') };
}

export function collectArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 2) {
    const [a, b] = args;
    const [x, y] = [Number(a), Number(b)];
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      return [`${x} ${y}`];
    }
  }
  return args;
}
