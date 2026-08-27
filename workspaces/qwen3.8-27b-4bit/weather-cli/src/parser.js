const DEFAULT = { name: 'Oslo', lat: 59.91, lon: 10.75 };
const DECIMAL = /^-?(\d+(\.\d*)?|\.\d+)$/;

export function isDecimal(s) {
  return typeof s === 'string' && DECIMAL.test(s.trim());
}

// argv -> { kind: 'default'|'coords'|'name', name, lat?, lon? }
export function parseArgs(argv) {
  if (argv.length === 0) {
    return { kind: 'default', name: DEFAULT.name, lat: DEFAULT.lat, lon: DEFAULT.lon };
  }
  if (argv.length === 2 && isDecimal(argv[0]) && isDecimal(argv[1])) {
    const lat = Number(argv[0]);
    const lon = Number(argv[1]);
    if (lat < -90 || lat > 90) throw new Error(`Invalid latitude "${argv[0]}" (must be -90..90)`);
    if (lon < -180 || lon > 180) throw new Error(`Invalid longitude "${argv[1]}" (must be -180..180)`);
    return { kind: 'coords', name: argv.join(' '), lat, lon };
  }
  return { kind: 'name', name: argv.join(' ') };
}
