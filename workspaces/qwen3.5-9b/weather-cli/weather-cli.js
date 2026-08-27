#!/usr/bin/env node

// Simple weather CLI for Bergen, Norway
const { parseArgs, parseCoordinates, parseLocationName } = require('./parser');
const { geocode } = require('./geocode');
const { fetchWeather } = require('./weather');
const { formatOutput } = require('./output');

// Bergen coordinates (default)
const BERGEN_LAT = 60.32820331378818;
const BERGEN_LONG = 5.298175036700542;

// Run the main function
async function main() {
  const args = parseArgs();
  const location = args.location;

  let lat, lon;

  if (location) {
    // Check if input looks like coordinates (two numbers)
    const coords = parseCoordinates(location);
    if (coords) {
      lat = coords.lat;
      lon = coords.lon;
      console.log(`Coordinates: (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
    } else {
      console.log(`Geocoding: ${location}...`);
      const geoResult = await geocode(location);
      if (geoResult) {
        console.log(`Found: ${geoResult.name} (${geoResult.lat.toFixed(4)}, ${geoResult.lon.toFixed(4)})`);
        lat = geoResult.lat;
        lon = geoResult.lon;
      } else {
        console.error('Could not find location. Please provide valid coordinates.');
        process.exit(1);
      }
    }
  } else {
    console.log('Weather in Bergen, Norway (Met.no API)');
    lat = BERGEN_LAT;
    lon = BERGEN_LONG;
  }

  const weather = await fetchWeather(lat, lon);
  let locationName = 'Bergen';
  if (location) {
    const coords = parseCoordinates(location);
    if (coords) {
      locationName = `Coords (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})`;
    } else {
      const geoResult = await geocode(location);
      if (geoResult) {
        locationName = geoResult.name;
      }
    }
  }
  const output = formatOutput(weather, locationName);
  console.log(output);
}

main();
