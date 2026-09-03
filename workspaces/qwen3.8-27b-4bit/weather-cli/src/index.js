#!/usr/bin/env node
"use strict";

const { parseLocation, ParseError } = require("./parser");
const { geocode, GeocodeError } = require("./geocode");
const {
  fetchForecast,
  closestEntry,
  extractDetails,
  WeatherError,
} = require("./weather");
const { render, OutputError } = require("./output");

const USER_AGENT = "weather-cli/1.0 https://github.com/hans/weather-cli";

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}

async function main(argv) {
  const arg = argv[2];

  let loc;
  try {
    loc = parseLocation(arg);
  } catch (e) {
    if (e instanceof ParseError) return fail(e.message);
    throw e;
  }

  let lat;
  let lon;
  let locationName;

  if (loc.kind === "coords") {
    lat = loc.lat;
    lon = loc.lon;
    locationName = loc.name;
  } else {
    try {
      const g = await geocode(loc.name, { userAgent: USER_AGENT });
      lat = g.lat;
      lon = g.lon;
      locationName = g.name;
    } catch (e) {
      if (e instanceof GeocodeError) return fail(e.message);
      throw e;
    }
  }

  let body;
  try {
    body = await fetchForecast(lat, lon, { userAgent: USER_AGENT });
  } catch (e) {
    if (e instanceof WeatherError) {
      // 403 is a hard ToS block (bad User-Agent), NOT throttling.
      // Only 429 is retryable. Do not back off against a 403.
      if (e.status === 403) {
        return fail(
          "Met.no rejected the request (HTTP 403). This is a User-Agent " +
            "policy block, not rate limiting — check the User-Agent header."
        );
      }
      if (e.status === 429) {
        return fail("Met.no is rate limiting (HTTP 429). Try again later.");
      }
      return fail(e.message);
    }
    throw e;
  }

  const timeseries = body && body.properties && body.properties.timeseries;
  let entry;
  try {
    entry = closestEntry(timeseries);
  } catch (e) {
    if (e instanceof WeatherError) return fail(e.message);
    throw e;
  }

  let details;
  try {
    details = extractDetails(entry);
  } catch (e) {
    if (e instanceof WeatherError) return fail(e.message);
    throw e;
  }

  let out;
  try {
    out = render(locationName, details);
  } catch (e) {
    if (e instanceof OutputError) return fail(e.message);
    throw e;
  }

  process.stdout.write(out + "\n");
}

main(process.argv).catch((e) => {
  fail(e && e.message ? e.message : String(e));
});

module.exports = { main, USER_AGENT };
