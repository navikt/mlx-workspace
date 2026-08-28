#!/usr/bin/env node

const { parseArgs } = require('./parser');
const { geocode } = require('./geocode');
const { fetchWeather, getDescription } = require('./weather');
const { formatOutput } = require('./output');

async function main() {
  try {
    // Skip 'node' and script path from args
    const args = process.argv.slice(2);
    const parsed = parseArgs(args);

    let locationName;
    let lat, lon;

    if (parsed.type === 'none') {
      // Default to Oslo
      locationName = 'Oslo';
      const coords = await geocode('Oslo');
      lat = coords.lat;
      lon = coords.lon;
    } else if (parsed.type === 'coordinates') {
      lat = parsed.lat;
      lon = parsed.lon;
      locationName = `${parsed.lat} ${parsed.lon}`;
    } else {
      // Location name - geocode it
      locationName = parsed.name;
      const coords = await geocode(parsed.name);
      lat = coords.lat;
      lon = coords.lon;
    }

    // Fetch weather data
    const weather = await fetchWeather(lat, lon);

    // Derive description from cloud coverage
    weather.description = getDescription(weather.cloudAreaFraction);

    // Format and output
    const output = formatOutput(weather, locationName);
    console.log(output);

    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
