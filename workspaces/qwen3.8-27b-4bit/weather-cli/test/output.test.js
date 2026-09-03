"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { render, describeClouds, OutputError } = require("../src/output");

test("describeClouds: exactly 75 is Partly cloudy (strict > 75)", () => {
  assert.equal(describeClouds(75), "Partly cloudy");
});

test("describeClouds: above 75 is Overcast", () => {
  assert.equal(describeClouds(76), "Overcast");
  assert.equal(describeClouds(100), "Overcast");
});

test("describeClouds: above 50 is Partly cloudy", () => {
  assert.equal(describeClouds(51), "Partly cloudy");
  assert.equal(describeClouds(74), "Partly cloudy");
});

test("describeClouds: above 25 is Mostly clear", () => {
  assert.equal(describeClouds(26), "Mostly clear");
  assert.equal(describeClouds(50), "Mostly clear");
});

test("describeClouds: 25 and below is Clear", () => {
  assert.equal(describeClouds(25), "Clear");
  assert.equal(describeClouds(0), "Clear");
});

test("describeClouds: absent fraction returns null (no confident guess)", () => {
  assert.equal(describeClouds(undefined), null);
  assert.equal(describeClouds(null), null);
  assert.equal(describeClouds(NaN), null);
});

test("render produces the full spec block", () => {
  const out = render("Oslo", {
    air_temperature: 10.8,
    cloud_area_fraction: 80,
    relative_humidity: 68.4,
    wind_speed: 1.4,
    air_pressure_at_sea_level: 1007.3,
    ultraviolet_index_clear_sky: 0.1,
  });
  const lines = out.split("\n");
  assert.equal(lines[0], "Weather in Oslo (Met.no API)");
  assert.equal(lines[1], "Temperature: 10.8°C");
  assert.equal(lines[2], "Description: Overcast");
  assert.equal(lines[3], "Humidity: 68.4%");
  assert.equal(lines[4], "Wind Speed: 1.4 m/s");
  assert.equal(lines[5], "Pressure: 1007.3 hPa");
  assert.equal(lines[6], "UV Index: 0.1");
});

test("render omits the UV line when UV is absent (no 'undefined')", () => {
  const out = render("Bergen", {
    air_temperature: 12,
    cloud_area_fraction: 10,
    relative_humidity: 70,
    wind_speed: 3,
    air_pressure_at_sea_level: 1010,
  });
  assert.ok(!out.includes("undefined"));
  assert.ok(!out.includes("UV Index"));
  assert.match(out, /Description: Clear/);
});

test("render throws when cloud fraction is missing", () => {
  assert.throws(
    () => render("Oslo", { air_temperature: 10 }),
    OutputError
  );
});

test("render throws when temperature is missing", () => {
  assert.throws(
    () => render("Oslo", { cloud_area_fraction: 10 }),
    OutputError
  );
});

test("render formats whole numbers without trailing .0", () => {
  const out = render("Oslo", {
    air_temperature: 12,
    cloud_area_fraction: 0,
    relative_humidity: 68,
    wind_speed: 2,
    air_pressure_at_sea_level: 1013,
    ultraviolet_index_clear_sky: 1,
  });
  assert.match(out, /Temperature: 12°C/);
  assert.match(out, /Humidity: 68%/);
  assert.match(out, /UV Index: 1/);
});
