/**
 * Parse CLI arguments and extract location.
 * Returns { type: 'coordinates', lat, lon } or { type: 'name', name }
 */
export function parseLocation(args) {
  const location = args[0];

  if (!location) {
    return null;
  }

  // Check if it's coordinates: two space-separated numbers
  const parts = location.trim().split(/\s+/);
  if (parts.length === 2) {
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    if (!isNaN(lat) && !isNaN(lon)) {
      // Validate coordinate ranges
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return { type: 'coordinates', lat, lon };
      }
    }
  }

  // Otherwise treat as place name
  return { type: 'name', name: location.trim() };
}
