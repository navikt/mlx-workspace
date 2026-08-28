#!/usr/bin/env node
import { collectArgs, parseLocation } from './lib/parse.js';
import { geocode } from './lib/geocode.js';
import { fetchWeather } from './lib/weather.js';
import { formatWeather } from './lib/output.js';

async function main() {
  const [arg] = collectArgs(process.argv);
  let location = parseLocation(arg);
  if (location.type === 'name') {
    location = await geocode(location.displayName);
  }
  const weather = await fetchWeather(location.lat, location.lon);
  process.stdout.write(formatWeather(location.displayName, weather) + '\n');
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
