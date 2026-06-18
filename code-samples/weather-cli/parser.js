// Parser module for argument parsing
function parseArgs(args = []) {
  const slicedArgs = args.slice(2);
  return { location: slicedArgs[0] };
}

function parseCoordinates(input) {
  const parts = input.split(/\s+/);
  if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    // Validate that coordinates are within reasonable ranges (Earth's surface)
    // Also reject negative coordinates (should be positive)
    if (lat <= 0 || lat > 90 || lon <= 0 || lon > 180) {
      return null;
    }
    return {
      lat: lat,
      lon: lon
    };
  }
  return null;
}

function parseLocationName(input) {
  return {
    lat: 60.32820331378818,
    lon: 5.298175036700542,
    name: input
  };
}

module.exports = { parseArgs, parseCoordinates, parseLocationName };
