#!/usr/bin/env node

import { parseArgs } from './parser.js';
import { geocode } from './geocode.js';
import { findClosestTimeseries } from './weather.js';
import { formatOutput } from './output.js';

const APP_NAME = 'weather-cli';
const APP_VERSION = '1.0';
const USER_AGENT = `${APP_NAME}/${APP_VERSION} github.com/weather-cli`;

async function main() {
  const location = parseArgs();

  let lat, lon, locationName;

  // Check if input is coordinates ("lat lon")
  const coordMatch = location.match(/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/);
  if (coordMatch) {
    lat = parseFloat(coordMatch[1]);
    lon = parseFloat(coordMatch[2]);

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      console.error('Error: Invalid coordinates');
      process.exit(1);
    }

    locationName = `${lat} ${lon}`;
  } else {
    // Geocode the location name
    const geoData = await geocode(location, USER_AGENT);
    const coords = geoData.geometry.coordinates;
    // GeoJSON returns [lon, lat], swap to [lat, lon]
    lon = coords[0];
    lat = coords[1];
    locationName = geoData.stedsnavn[0].skrivemåte || location;
  }

  // Fetch weather data
  const weatherData = await fetchWeather(lat, lon, USER_AGENT);

  // Find closest timeseries entry to current time (in UTC)
  const closest = findClosestTimeseries(weatherData.properties.timeseries, new Date());

  // Extract data from the closest entry
  const output = formatOutput(locationName, closest);

  console.log(output);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
