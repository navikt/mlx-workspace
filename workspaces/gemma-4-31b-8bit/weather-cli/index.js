#!/usr/bin/env node
const { parseArgs } = require('./parser');
const { geocode } = require('./geocode');
const { fetchWeather } = require('./weather');
const { formatWeather } = require('./output');

async function main() {
  try {
    const args = process.argv.slice(2);
    const locationInput = parseArgs(args);

    if (locationInput.type === 'none') {
      console.error('Error: Location is required');
      process.exit(1);
    }

    let lat, lon, locationName;

    if (locationInput.type === 'coords') {
      lat = locationInput.lat;
      lon = locationInput.lon;
      locationName = `${lat}, ${lon}`;
    } else {
      const geo = await geocode(locationInput.name);
      lat = geo.lat;
      lon = geo.lon;
      locationName = geo.name;
    }

    const weatherData = await fetchWeather(lat, lon);
    const output = formatWeather(locationName, weatherData);
    console.log(output);
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
