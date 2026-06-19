/**
 * Parse command-line arguments for weather CLI
 * @param {string[]} args - Command line arguments
 * @returns {{type: 'coordinates'|'place', lat?: number, lon?: number, name?: string, error?: string}}
 */
export function parseArgs(args) {
  if (!args || args.length === 0) {
    return { type: 'place', name: 'Oslo' }; // Default to Oslo
  }

  const input = args.join(' ');

  // Try to parse as coordinates (lat lon format)
  const coordinateMatch = input.match(/^\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*$/);
  
  if (coordinateMatch) {
    const lat = parseFloat(coordinateMatch[1]);
    const lon = parseFloat(coordinateMatch[2]);

    // Validate latitude range
    if (lat < -90 || lat > 90) {
      return {
        type: 'error',
        error: 'Invalid coordinates: latitude must be between -90 and 90'
      };
    }

    // Validate longitude range
    if (lon < -180 || lon > 180) {
      return {
        type: 'error',
        error: 'Invalid coordinates: longitude must be between -180 and 180'
      };
    }

    return { type: 'coordinates', lat, lon };
  }

  // Treat as place name
  const placeName = input.trim();
  if (placeName.length === 0) {
    return {
      type: 'error',
      error: 'Location cannot be empty'
    };
  }

  return { type: 'place', name: placeName };
}
