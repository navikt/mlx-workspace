#!/usr/bin/env node
import { parseLocation } from './parseArgs.js';
import { geocode } from './geocode.js';
import { fetchWeather } from './fetchWeather.js';
import { formatWeather } from './format.js';

const DEFAULT_LOCATION = { lat: 59.91, lon: 10.75, name: 'Oslo' };

async function main() {
  const input = process.argv.slice(2).join(' ');
  let location;
  try {
    const parsed = parseLocation(input);
    location =
      parsed.kind === 'coords'
        ? { lat: parsed.lat, lon: parsed.lon, name: `${parsed.lat}, ${parsed.lon}` }
        : parsed.kind === 'name'
          ? await geocode(parsed.name)
          : DEFAULT_LOCATION;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  try {
    const details = await fetchWeather(location.lat, location.lon);
    console.log(formatWeather(location.name, details));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
