import { parseArgs } from './parser.js';
import { geocode } from './geocode.js';
import { fetchWeather } from './weather.js';
import { formatOutput } from './output.js';

const args = parseArgs(process.argv.slice(2));
const location = args.location;

if (!location) {
  console.error('Usage: weather [location|lat lon]');
  process.exit(1);
}

try {
  let locationName;
  let lat, lon;

  if (location.type === 'coords') {
    lat = location.value.lat;
    lon = location.value.lon;
    locationName = `${lat} ${lon}`;
  } else {
    const result = await geocode(location.value);
    locationName = result.name;
    lat = result.lat;
    lon = result.lon;
  }

  const weather = await fetchWeather(lat, lon);
  console.log(formatOutput(locationName, weather));
  process.exit(0);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
