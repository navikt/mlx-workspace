export function parseLocation(input) {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return { kind: 'default' };

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 2) {
    const lat = Number(tokens[0]);
    const lon = Number(tokens[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      if (lat < -90 || lat > 90) throw new Error(`Invalid latitude: ${tokens[0]}`);
      if (lon < -180 || lon > 180) throw new Error(`Invalid longitude: ${tokens[1]}`);
      return { kind: 'coords', lat, lon };
    }
  }
  return { kind: 'name', name: trimmed };
}
