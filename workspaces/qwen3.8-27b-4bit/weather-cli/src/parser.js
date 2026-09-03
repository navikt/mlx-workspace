export function parseLocation(arg) {
  if (arg === undefined || arg.trim() === '') {
    return { kind: 'default' };
  }
  const parts = arg.trim().split(/\s+/);
  if (parts.length === 2) {
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon) &&
        lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { kind: 'coords', lat, lon, label: `${parts[0]} ${parts[1]}` };
    }
  }
  return { kind: 'name', name: arg.trim() };
}
