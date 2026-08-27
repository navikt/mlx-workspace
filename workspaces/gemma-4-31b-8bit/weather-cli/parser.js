function parseArgs(args) {
  const location = args[0];
  if (!location) return { type: 'none' };

  const coordRegex = /^-?\d+(\.\d+)?\s+-?\d+(\.\d+)?$/;
  if (coordRegex.test(location)) {
    const [lat, lon] = location.split(' ').map(Number);
    return { type: 'coords', lat, lon };
  }

  return { type: 'name', name: location };
}

module.exports = { parseArgs };
