/**
 * Parse a location string into { lat, lon, name }.
 *
 * Supports two formats:
 *   - "lat lon" (space-separated decimals) → coordinates
 *   - Any other string → location name (resolved later by geocoder)
 *
 * @param {string} input
 * @returns {{ lat: number, lon: number, name: string }}
 * @throws {Error} on invalid coordinate format
 */
export function parseLocation(input) {
  if (!input || typeof input !== 'string' || input.trim() === '') {
    throw new Error('Location is required');
  }

  const trimmed = input.trim();

  // Try parsing as coordinates: "lat lon"
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

    return { lat, lon, name: trimmed };
  }

  // Location name — geocoder will resolve later
  return { name: trimmed };
}
