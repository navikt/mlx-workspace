#!/usr/bin/env node

import { parseLocation } from './parser.js';
import { geocodeGeonorge } from './geocode.js';
import { fetchWeather } from './weather.js';
import { formatWeather } from './output.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: weather [location]');
    console.error('  location: place name (e.g. "Oslo") or coordinates (e.g. "59.91 10.75")');
    process.exit(1);
  }

  const locationInput = args.join(' ');

  try {
    // Step 1: Parse location
    const parsed = parseLocation(locationInput);

    // Step 2: If name only, geocode
    let lat, lon, locationName;
    if (parsed.lat !== undefined && parsed.lon !== undefined) {
      lat = parsed.lat;
      lon = parsed.lon;
      locationName = parsed.name;
    } else {
      const geo = await geocodeGeonorge(parsed.name);
      lat = geo.lat;
      lon = geo.lon;
      locationName = geo.displayName;
    }

    // Step 3: Fetch weather
    const weather = await fetchWeather(lat, lon);

    // Step 4: Format and output
    const output = formatWeather(weather, locationName);
    console.log(output);
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
