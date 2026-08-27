export function parseArgs(argv) {
  if (argv.length === 0) {
    return { location: null };
  }

  // Check if first two args are both numbers (coordinates passed separately by shell)
  if (argv.length >= 2) {
    const coordMatch1 = argv[0].trim().match(/^-?\d+\.?\d*$/);
    const coordMatch2 = argv[1].trim().match(/^-?\d+\.?\d*$/);
    if (coordMatch1 && coordMatch2) {
      const lat = parseFloat(argv[0].trim());
      const lon = parseFloat(argv[1].trim());
      if (lat < -90 || lat > 90) {
        throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
      }
      if (lon < -180 || lon > 180) {
        throw new Error(`Invalid longitude: ${lon}. Must be between -180 and 180.`);
      }
      return { location: { type: 'coords', value: { lat, lon } } };
    }
  }

  const arg = argv[0].trim();

  // Check if it's coordinates: "lat lon" (two space-separated numbers)
  const coordMatch = arg.match(/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);

    // Validate coordinate ranges
    if (lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
    }
    if (lon < -180 || lon > 180) {
      throw new Error(`Invalid longitude: ${lon}. Must be between -180 and 180.`);
    }

    return { location: { type: 'coords', value: { lat, lon } } };
  }

  // Treat as location name
  return { location: { type: 'name', value: arg } };
}
