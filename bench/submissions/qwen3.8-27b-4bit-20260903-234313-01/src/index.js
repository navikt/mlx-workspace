#!/usr/bin/env node
import { parseLocation } from './parse.js';
import { geocode } from './geocode.js';
import { fetchWeather } from './weather.js';
import { format } from './output.js';

async function main() {
  const parsed = parseLocation(process.argv.slice(2).join(' '));
  const loc = parsed.type === 'coords'
    ? { lat: parsed.lat, lon: parsed.lon, name: parsed.name }
    : await geocode(parsed.name);
  const w = await fetchWeather(loc.lat, loc.lon);
  process.stdout.write(format(loc.name, w) + '\n');
}

main().catch((err) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
