/**
 * Parse CLI location argument.
 * Returns { type: 'coords', lat, lon } or { type: 'name', name }
 * Throws on invalid input.
 */
export function parseLocation(input) {
  if (!input || input.trim() === '') {
    throw new Error('Location argument is required. Usage: weather [location]');
  }

  const trimmed = input.trim();

  // Check for coordinates pattern: "lat lon" (two space-separated numbers)
  const coordMatch = trimmed.match(/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);

    if (lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
    }
    if (lon < -180 || lon > 180) {
      throw new Error(`Invalid longitude: ${lon}. Must be between -180 and 180.`);
    }

    return { type: 'coords', lat, lon };
  }

  // Otherwise treat as location name
  return { type: 'name', name: trimmed };
}
