import { parseLocation } from './parser.js';
import { geocode } from './geocode.js';
import { fetchWeather, findClosestEntry, extractData } from './weather.js';
import { formatOutput } from './output.js';

async function main() {
  const input = process.argv[2];

  try {
    const location = parseLocation(input);

    let lat, lon, displayName;

    if (location.type === 'coordinates') {
      lat = location.lat;
      lon = location.lon;
      displayName = `(${location.lat}, ${location.lon})`;
    } else {
      const geo = await geocode(location.name);
      lat = geo.lat;
      lon = geo.lon;
      displayName = geo.displayName;
    }

    const weatherData = await fetchWeather(lat, lon);
    const closestEntry = findClosestEntry(weatherData.properties.timeseries);
    const data = extractData(closestEntry);
    const output = formatOutput(displayName, data);

    console.log(output);
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
