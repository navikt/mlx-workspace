import { parseLocation } from './parser.js';
import { geocode } from './geocode.js';
import { fetchWeather } from './weather.js';
import { formatWeather } from './output.js';

async function main() {
  const locationInput = process.argv[2];

  if (!locationInput) {
    console.error('Usage: weather [location]');
    console.error('  location: place name (e.g., "Oslo") or coordinates (e.g., "59.91 10.75")');
    process.exit(1);
  }

  try {
    const parsed = parseLocation(locationInput);

    let locationName;
    let lat, lon;

    if (parsed.type === 'coords') {
      lat = parsed.lat;
      lon = parsed.lon;
      locationName = `${lat} ${lon}`;
    } else {
      const geoResult = await geocode(parsed.name);
      locationName = geoResult.displayName;
      lat = geoResult.lat;
      lon = geoResult.lon;
    }

    const weather = await fetchWeather(lat, lon);
    const output = formatWeather(locationName, weather);

    console.log(output);
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
