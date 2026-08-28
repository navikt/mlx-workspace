import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWeather, toWeather, describeClouds } from '../src/weather.js';

function entry(time, details) {
  return { time, data: { instant: { details } } };
}

const details = {
  air_temperature: 17.2,
  relative_humidity: 74.3,
  wind_speed: 4.9,
  air_pressure_at_sea_level: 1016.3,
  ultraviolet_index_clear_sky: 3.1,
  cloud_area_fraction: 100.0,
};

const payload = {
  properties: {
    timeseries: [
      entry('2026-08-28T10:00:00Z', details),
      entry('2026-08-28T11:00:00Z', { ...details, air_temperature: 18.0 }),
    ],
  },
};

test('toWeather picks the timeseries entry closest to now', () => {
  const before = toWeather(payload, new Date('2026-08-28T10:30:00Z'));
  assert.equal(before.temperature, 17.2);
  const after = toWeather(payload, new Date('2026-08-28T11:10:00Z'));
  assert.equal(after.temperature, 18.0);
});

test('toWeather extracts all output fields from instant.details', () => {
  const w = toWeather(payload, new Date('2026-08-28T10:00:00Z'));
  assert.deepEqual(w, {
    temperature: 17.2,
    description: 'Overcast',
    humidity: 74.3,
    windSpeed: 4.9,
    pressure: 1016.3,
    uvIndex: 3.1,
  });
});

test('toWeather throws on empty or missing timeseries', () => {
  assert.throws(() => toWeather({ properties: { timeseries: [] } }, new Date()));
  assert.throws(() => toWeather({}, new Date()));
});

test('toWeather throws when the closest entry has no instant details', () => {
  const p = { properties: { timeseries: [{ time: '2026-08-28T10:00:00Z', data: {} }] } };
  assert.throws(() => toWeather(p, new Date('2026-08-28T10:00:00Z')), /No instant details/);
});

test('describeClouds applies the spec thresholds', () => {
  assert.equal(describeClouds(100), 'Overcast');
  assert.equal(describeClouds(76), 'Overcast');
  assert.equal(describeClouds(75), 'Partly cloudy');
  assert.equal(describeClouds(51), 'Partly cloudy');
  assert.equal(describeClouds(50), 'Mostly clear');
  assert.equal(describeClouds(26), 'Mostly clear');
  assert.equal(describeClouds(25), 'Clear');
  assert.equal(describeClouds(0), 'Clear');
});

test('fetchWeather sends lat/lon params and a User-Agent', async () => {
  const now = new Date();
  const iso = (offsetMin) => new Date(now.getTime() + offsetMin * 60000).toISOString();
  const p = {
    properties: {
      timeseries: [
        entry(iso(-10), details),
        entry(iso(30), { ...details, air_temperature: 18.0 }),
      ],
    },
  };
  let req;
  const http = async (url, config) => {
    req = { url, config };
    return { data: p };
  };
  const w = await fetchWeather(59.91, 10.75, http);
  assert.equal(w.temperature, 17.2);
  assert.match(req.url, /^https:\/\/api\.met\.no\/weatherapi\/locationforecast\/2\.0\/complete$/);
  assert.deepEqual(req.config.params, { lat: 59.91, lon: 10.75 });
  assert.match(req.config.headers['User-Agent'], /weather-cli/);
});
