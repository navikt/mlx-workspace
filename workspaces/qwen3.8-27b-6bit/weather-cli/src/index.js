#!/usr/bin/env node
import { parseArgs } from './parser.js';
import { geocode } from './geocode.js';
import { fetchWeather } from './weather.js';
import { formatWeather } from './output.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const place =
    args.type === 'coords'
      ? { name: `${args.lat} ${args.lon}`, lat: args.lat, lon: args.lon }
      : await geocode(args.name);
  const weather = await fetchWeather(place.lat, place.lon);
  console.log(formatWeather(place.name, weather));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
