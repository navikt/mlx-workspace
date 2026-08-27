/**
 * Parse CLI arguments into a location descriptor.
 *
 * Returns { type: "coordinates", lat, lon } when the input matches
 * "lat lon" format, or { type: "name", name } for plain strings.
 * When no argument is given, defaults to "Oslo".
 */

const COORDINATE_PATTERN = /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/;

/**
 * Parse the location argument from process.argv.
 * @param {string[]} argv - process.argv array (defaults to process.argv)
 * @returns {{ type: "coordinates"|"name", lat?: number, lon?: number, name?: string }}
 */
export function parseLocation(argv = process.argv) {
  const arg = argv[2];

  // No argument provided — default to Oslo
  if (!arg || arg.trim() === "") {
    return { type: "name", name: "Oslo" };
  }

  const trimmed = arg.trim();

  // Try coordinate pattern: "59.91 10.75"
  const match = trimmed.match(COORDINATE_PATTERN);
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);

    // Validate ranges
    if (lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
    }
    if (lon < -180 || lon > 180) {
      throw new Error(`Invalid longitude: ${lon}. Must be between -180 and 180.`);
    }

    return { type: "coordinates", lat, lon };
  }

  // Treat as location name
  return { type: "name", name: trimmed };
}
