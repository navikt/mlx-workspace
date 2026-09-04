#!/usr/bin/env node
import { parseLocation, validateCoords } from "./parser.js";
import { geocode } from "./geocode.js";
import { fetchWeather } from "./weather.js";
import { formatWeather } from "./output.js";

const pkg = { name: "weather-cli", version: "1.0.0" };

export const USER_AGENT = `weather-cli/1.0 https://github.com/hans/weather-cli`;

export async function run(argv, { geocode: g = geocode, fetchWeather: f = fetchWeather, stdout = process.stdout, stderr = process.stderr } = {}) {
  const location = parseLocation(argv);
  if (location.kind === "none") {
    stderr.write("Usage: weather <location> | weather <lat> <lon>\n");
    return 1;
  }
  let place;
  if (location.kind === "coords") {
    const check = validateCoords(location);
    if (!check.ok) {
      stderr.write(`${check.error}\n`);
      return 1;
    }
    place = { name: `${location.lat}, ${location.lon}`, lat: location.lat, lon: location.lon };
  } else {
    try {
      place = await g(location.name, { headers: { "User-Agent": USER_AGENT } });
    } catch (err) {
      stderr.write(`${err.message}\n`);
      return 1;
    }
  }
  let weather;
  try {
    weather = await f(place, { headers: { "User-Agent": USER_AGENT } });
  } catch (err) {
    stderr.write(`${err.message}\n`);
    return 1;
  }
  stdout.write(formatWeather(place.name, weather) + "\n");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
  );
}
