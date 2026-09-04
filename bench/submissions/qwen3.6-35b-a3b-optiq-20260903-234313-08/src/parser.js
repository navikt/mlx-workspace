export function parseArgs() {
  const location = process.argv[2];

  if (!location) {
    return { type: 'default', name: 'Oslo' };
  }

  // Check if it's coordinates (two space-separated numbers)
  const parts = location.trim().split(/\s+/);
  if (parts.length === 2) {
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lon)) {
      throw new Error('Error: Invalid coordinates. Expected format: "lat lon"');
    }

    if (lat < -90 || lat > 90) {
      throw new Error('Error: Invalid latitude. Must be between -90 and 90.');
    }

    if (lon < -180 || lon > 180) {
      throw new Error('Error: Invalid longitude. Must be between -180 and 180.');
    }

    return { type: 'coordinates', lat, lon };
  }

  // Single string - treat as location name
  return { type: 'name', name: location.trim() };
}
