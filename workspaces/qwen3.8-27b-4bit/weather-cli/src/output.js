"use strict";

class OutputError extends Error {
  constructor(message) {
    super(message);
    this.name = "OutputError";
  }
}

/**
 * Derive a human description from cloud_area_fraction (0-100 %).
 * Strict thresholds: exactly 75 is "Partly cloudy" (the > 75 branch is
 * Overcast, so 75 falls below it).
 * Returns null when cloud cover is absent — callers must not print a
 * confident wrong answer.
 */
function describeClouds(fraction) {
  if (fraction === undefined || fraction === null || Number.isNaN(fraction)) {
    return null;
  }
  if (fraction > 75) return "Overcast";
  if (fraction > 50) return "Partly cloudy";
  if (fraction > 25) return "Mostly clear";
  return "Clear";
}

/**
 * Round to one decimal for display, dropping a trailing .0.
 */
function fmt(value) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }
  const r = Math.round(value * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r);
}

/**
 * Render the final output block. Throws OutputError when required fields
 * (cloud fraction) are missing, so a confident wrong answer never prints.
 */
function render(locationName, details) {
  const lines = [`Weather in ${locationName} (Met.no API)`];

  const temp = details.air_temperature;
  if (temp === undefined || temp === null || Number.isNaN(temp)) {
    throw new OutputError("Missing temperature in forecast");
  }
  lines.push(`Temperature: ${fmt(temp)}°C`);

  const clouds = describeClouds(details.cloud_area_fraction);
  if (clouds === null) {
    throw new OutputError("Missing cloud cover in forecast");
  }
  lines.push(`Description: ${clouds}`);

  const humidity = details.relative_humidity;
  if (humidity !== undefined && humidity !== null && !Number.isNaN(humidity)) {
    lines.push(`Humidity: ${fmt(humidity)}%`);
  }

  const wind = details.wind_speed;
  if (wind !== undefined && wind !== null && !Number.isNaN(wind)) {
    lines.push(`Wind Speed: ${fmt(wind)} m/s`);
  }

  const pressure = details.air_pressure_at_sea_level;
  if (pressure !== undefined && pressure !== null && !Number.isNaN(pressure)) {
    lines.push(`Pressure: ${fmt(pressure)} hPa`);
  }

  // UV index is optional: absent data must not read as data.
  const uv = details.ultraviolet_index_clear_sky;
  if (uv !== undefined && uv !== null && !Number.isNaN(uv)) {
    lines.push(`UV Index: ${fmt(uv)}`);
  }

  return lines.join("\n");
}

module.exports = { render, describeClouds, OutputError };
