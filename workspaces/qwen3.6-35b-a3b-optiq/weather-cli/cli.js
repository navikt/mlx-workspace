#!/usr/bin/env node

import { parseLocation } from './parser.js';
import { geocodeLocation, fetchWeather, findClosestTimeseries, getDescription } from './weather.js';
import { formatWeather } from './output.js';

async function main() {
  try {
    // 1. Parse location argument
    const location = parseLocation(process.argv);

    let lat, lon, locationName;

    if (location.type === 'coordinates') {
      lat = location.lat;
      lon = location.lon;
      locationName = `${lat} ${lon}`;
    } else {
      // 2. Geocode location name
      const geocodeResult = await geocodeLocation(location.name);
      lat = geocodeResult.lat;
      lon = geocodeResult.lon;
      locationName = geocodeResult.name;
    }

    // 3. Fetch weather data
    const weatherData = await fetchWeather(lat, lon);

    // 4. Find closest timeseries entry (UTC)
    const closestEntry = findClosestTimeseries(weatherData);

    // 5. Extract data from instant.details
    const instant = closestEntry.instant;
    const details = instant.details || {};

    const temperature = details.temperature != null ? details.temperature : 'N/A';
    const humidity = details.relative_humidity != null ? details.relative_humidity : 'N/A';
    const windSpeed = details.wind_speed != null ? details.wind_speed : 'N/A';
    const pressure = details.air_pressure_at_sea_level != null ? details.air_pressure_at_sea_level : 'N/A';
    const uvIndex = details.ultraviolet_index_clear_sky != null ? details.ultraviolet_index_clear_sky : 'N/A';

    // 6. Derive description from cloud_area_fraction
    const description = getDescription(details);

    const weather = {
      temperature,
      description,
      humidity,
      windSpeed,
      pressure,
      uvIndex,
    };

    // 7. Format and output
    const output = formatWeather(locationName, weather);
    console.log(output);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
