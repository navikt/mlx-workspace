#!/usr/bin/env node
'use strict';

const { parseLocation } = require('./parser');
const { geocode } = require('./geocode');
const { fetchWeather } = require('./weather');
const { formatWeather } = require('./output');

const USER_AGENT = process.env.WEATHER_CLI_USER_AGENT || 'weather-cli/1.0 github.com/hans/weather-cli';

async function run(argv, { axiosInstance, now } = {}) {
  const locationArg = argv.slice(2).join(' ');
  const parsed = parseLocation(locationArg);

  const place =
    parsed.lat !== undefined
      ? parsed
      : await geocode(parsed.name, { userAgent: USER_AGENT, axiosInstance });

  const weather = await fetchWeather(
    { lat: place.lat, lon: place.lon, userAgent: USER_AGENT },
    { axiosInstance, now }
  );
  return formatWeather(place.name, weather);
}

module.exports = { run, USER_AGENT };

if (require.main === module) {
  run(process.argv)
    .then((out) => {
      console.log(out);
    })
    .catch((err) => {
      const msg = err && err.message ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    });
}
