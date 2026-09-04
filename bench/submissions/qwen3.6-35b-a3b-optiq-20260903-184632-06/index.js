#!/usr/bin/env node

import { parseLocation } from './src/parser.js';
import { geocode } from './src/geocode.js';
import { fetchWeather } from './src/weather.js';
import { formatOutput } from './src/output.js';

const locationArg = process.argv[2];

try {
  const parsed = parseLocation(locationArg);

  let lat, lon, locationName;

  if (parsed.type === 'coords') {
    lat = parsed.lat;
    lon = parsed.lon;
    locationName = `${lat} ${lon}`;
  } else {
    const geoResult = await geocode(parsed.value);
    lat = geoResult.lat;
    lon = geoResult.lon;
    locationName = geoResult.name;
  }

  const weather = await fetchWeather(lat, lon);
  const output = formatOutput(locationName, weather);
  process.stdout.write(output);
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
}
