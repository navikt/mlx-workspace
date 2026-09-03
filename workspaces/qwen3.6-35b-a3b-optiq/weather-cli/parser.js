/**
 * Parse the location argument from CLI args.
 * Returns { type: 'coordinates', lat, lon } or { type: 'name', name }
 * or throws an Error if the location is invalid.
 */
export function parseLocation(argv) {
  const locationArg = argv[2];

  if (!locationArg) {
    return { type: 'name', name: 'Oslo' };
  }

  // Check if it looks like coordinates: two space-separated numbers
  const coordMatch = locationArg.match(/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/);

  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);

    // Validate latitude: -90 to 90
    if (lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
    }

    // Validate longitude: -180 to 180
    if (lon < -180 || lon > 180) {
      throw new Error(`Invalid longitude: ${lon}. Must be between -180 and 180.`);
    }

    return { type: 'coordinates', lat, lon };
  }

  // Treat as location name
  return { type: 'name', name: locationArg };
}
