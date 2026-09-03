const COORDINATES_REGEX = /^-?\d+(\.\d+)?\s+-?\d+(\.\d+)?$/;

export function parseLocation(input) {
  if (!input || input.trim() === '') {
    return { type: 'name', name: 'Oslo' };
  }

  const trimmed = input.trim();

  if (COORDINATES_REGEX.test(trimmed)) {
    const parts = trimmed.split(/\s+/);
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lon)) {
      throw new Error(`Invalid coordinates: "${input}"`);
    }

    if (lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
    }

    if (lon < -180 || lon > 180) {
      throw new Error(`Invalid longitude: ${lon}. Must be between -180 and 180.`);
    }

    return { type: 'coordinates', lat, lon };
  }

  return { type: 'name', name: trimmed };
}
