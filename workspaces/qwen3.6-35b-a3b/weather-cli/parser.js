/**
 * Parses command-line arguments for the weather CLI.
 * Returns { type: 'coordinates', lat, lon } or { type: 'location', name }
 * or { type: 'none' } for default (Oslo).
 * Throws on invalid coordinate format.
 */

function parseArgs(args = []) {
  if (args.length === 0) {
    return { type: 'none' };
  }

  const location = args[0].trim();

  // Try to parse as coordinates: "lat lon"
  const coordMatch = location.match(/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);

    // Validate ranges
    if (lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
    }
    if (lon < -180 || lon > 180) {
      throw new Error(`Invalid longitude: ${lon}. Must be between -180 and 180.`);
    }

    return { type: 'coordinates', lat, lon };
  }

  // Check if it looks like partial/invalid coordinates
  if (/^-?\d+\.?\d*\s+$/.test(location.trim()) || /^\s*-?\d+\.?\d*$/.test(location.trim())) {
    throw new Error(`Invalid coordinate format: "${location}". Expected "lat lon".`);
  }

  // Treat as location name
  return { type: 'location', name: location };
}

module.exports = { parseArgs };
