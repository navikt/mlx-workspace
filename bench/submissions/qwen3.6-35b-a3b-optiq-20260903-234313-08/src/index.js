import { parseArgs } from './parser.js';
import { geocode, fetchWeather } from './weather.js';
import { formatWeather } from './output.js';

export async function run() {
  try {
    const args = parseArgs();

    let lat, lon, locationName;

    if (args.type === 'coordinates') {
      lat = args.lat;
      lon = args.lon;
      locationName = `${args.lat} ${args.lon}`;
    } else if (args.type === 'name') {
      const geo = await geocode(args.name);
      lat = geo.lat;
      lon = geo.lon;
      locationName = geo.locationName;
    } else {
      // default
      const geo = await geocode('Oslo');
      lat = geo.lat;
      lon = geo.lon;
      locationName = geo.locationName;
    }

    const weather = await fetchWeather(lat, lon);
    const output = formatWeather(locationName, weather);

    console.log(output);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

run();
