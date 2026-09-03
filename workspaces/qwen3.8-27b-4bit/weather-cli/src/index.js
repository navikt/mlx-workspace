#!/usr/bin/env node
import { parseLocation } from './parser.js';
import { geocode, USER_AGENT } from './geocode.js';
import { fetchWeather } from './weather.js';
import { formatWeather } from './output.js';

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function statusOf(err) {
  return err.response?.status ?? err.status;
}

function describeHttpError(err) {
  const status = statusOf(err);
  if (status === 403) {
    return 'Request rejected (HTTP 403). Met.no requires an honest User-Agent identifying the app with a real contact; this is a hard block, not rate limiting.';
  }
  if (status === 429) {
    return 'Rate limited (HTTP 429). Try again later.';
  }
  return err.message;
}

async function main() {
  const [arg] = process.argv.slice(2);
  const loc = parseLocation(arg);

  let lat;
  let lon;
  let locationName;
  if (loc.kind === 'coords') {
    lat = loc.lat;
    lon = loc.lon;
    locationName = loc.label;
  } else if (loc.kind === 'name') {
    const geo = await geocode(loc.name);
    lat = geo.lat;
    lon = geo.lon;
    locationName = geo.name;
  } else {
    const geo = await geocode('Oslo');
    lat = geo.lat;
    lon = geo.lon;
    locationName = geo.name;
  }

  const wx = await fetchWeather(lat, lon);
  process.stdout.write(formatWeather({
    locationName,
    details: wx.details,
    hasUv: wx.hasUv,
    uv: wx.uv,
  }) + '\n');
}

main().catch((err) => {
  fail(statusOf(err) ? describeHttpError(err) : err.message);
});
