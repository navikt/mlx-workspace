import { parseArgs as parseArgsLib } from 'node:util';

export function parseArgs() {
  const { positionals } = parseArgsLib({
    strict: false,
    allowPositionals: true,
  });

  if (positionals.length === 0) {
    console.error('Usage: weather [location]');
    console.error('  location: place name (e.g., "Oslo") or coordinates (e.g., "59.91 10.75")');
    process.exit(1);
  }

  const location = positionals[0];

  if (typeof location !== 'string' || location.trim() === '') {
    console.error('Error: Location must be a non-empty string');
    process.exit(1);
  }

  return location.trim();
}
