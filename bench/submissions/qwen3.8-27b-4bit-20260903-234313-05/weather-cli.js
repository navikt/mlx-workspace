#!/usr/bin/env node
'use strict';

const { parseLocation } = require('./parser');
const { geocode } = require('./geocode');
const { fetchWeather, extractWeather } = require('./weather');
const { formatOutput } = require('./output');

async function main(argv) {
  const location = parseLocation(argv);
  let name = location.name;
  let { lat, lon } = location;
  if (location.type === 'name') {
    const resolved = await geocode(location.name);
    name = resolved.name;
    lat = resolved.lat;
    lon = resolved.lon;
  }
  const data = await fetchWeather(lat, lon);
  process.stdout.write(formatOutput(name, extractWeather(data)) + '\n');
}

main(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
