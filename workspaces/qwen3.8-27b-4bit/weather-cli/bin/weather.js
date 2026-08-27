#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../src/parser.js';
import { geocode } from '../src/geocode.js';
import { fetchWeather } from '../src/weather.js';
import { formatWeather } from '../src/output.js';

// Full flow: parse -> (geocode) -> fetch -> format. geocode/fetchWeather injectable for tests.
export async function run(argv, deps = {}) {
  const geocodeFn = deps.geocode ?? geocode;
  const fetchFn = deps.fetchWeather ?? fetchWeather;
  let loc = parseArgs(argv);
  let name = loc.name;
  let lat = loc.lat;
  let lon = loc.lon;
  if (loc.kind === 'name') {
    const g = await geocodeFn(loc.name);
    name = g.name;
    lat = g.lat;
    lon = g.lon;
  }
  const w = await fetchFn(lat, lon);
  return formatWeather(name, w);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2))
    .then((out) => console.log(out))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
