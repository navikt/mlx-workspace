#!/usr/bin/env node
'use strict';

const { parseArgs } = require('./src/parser');
const { geocode } = require('./src/geocode');
const { fetchWeather } = require('./src/weather');
const { formatWeather } = require('./src/output');

async function run(argv, options = {}) {
  const parsed = parseArgs(argv);
  if (parsed.kind === 'none') {
    throw Object.assign(new Error('No location given. Usage: weather [location]'), { exitCode: 1 });
  }

  const now = options.now || new Date();
  let lat;
  let lon;
  let locationName;
  if (parsed.kind === 'coords') {
    lat = parsed.lat;
    lon = parsed.lon;
    locationName = `${lat}, ${lon}`;
  } else {
    const place = await geocode(parsed.name, options);
    lat = place.lat;
    lon = place.lon;
    locationName = place.name;
  }

  const weather = await fetchWeather(lat, lon, { ...options, now });
  return formatWeather(locationName, weather.details);
}

if (require.main === module) {
  run(process.argv.slice(2))
    .then((output) => {
      console.log(output);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`Error: ${error.message}`);
      process.exit(error.exitCode || 1);
    });
}

module.exports = { run };
