#!/usr/bin/env node

import { parseLocation } from './src/parser.js';
import { geocode } from './src/geocode.js';
import { fetchWeather } from './src/weather.js';
import { formatWeather } from './src/output.js';

async function main() {
  const locationArg = process.argv[2];

  try {
    // Parse location argument
    const location = parseLocation(locationArg);

    let lat, lon, locationName;

    if (location.type === 'coords') {
      // Coordinates provided directly
      lat = location.lat;
      lon = location.lon;
      locationName = `${location.lat} ${location.lon}`;
    } else {
      // Geocode the location name
      const geoResult = await geocode(location.name);
      lat = geoResult.lat;
      lon = geoResult.lon;
      locationName = geoResult.name;
    }

    // Fetch weather data
    const weather = await fetchWeather(lat, lon);

    // Format and output
    const output = formatWeather(locationName, weather);
    console.log(output);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
