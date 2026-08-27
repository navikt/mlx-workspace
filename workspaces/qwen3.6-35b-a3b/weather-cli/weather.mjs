import { parseLocation } from "./src/parser.mjs";
import { geocode, fetchWeather } from "./src/weather.mjs";
import { formatWeather } from "./src/output.mjs";

async function main() {
  try {
    // Step 1: Parse location from CLI args
    const location = parseLocation();

    let locationName;
    let lat;
    let lon;

    // Step 2: If coordinates, use directly; otherwise geocode
    if (location.type === "coordinates") {
      lat = location.lat;
      lon = location.lon;
      locationName = `${location.lat}°N, ${location.lon}°E`;
    } else {
      // Step 3: Geocode location name to coordinates
      const geo = await geocode(location.name);
      locationName = geo.name;
      lat = geo.lat;
      lon = geo.lon;
    }

    // Step 4: Fetch weather data
    const weather = await fetchWeather(lat, lon);

    // Step 5: Format and output
    const output = formatWeather({ locationName, ...weather });
    console.log(output);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
