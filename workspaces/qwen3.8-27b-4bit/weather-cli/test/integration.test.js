import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation } from '../src/parser.js';
import { geocode } from '../src/geocode.js';
import { fetchWeather } from '../src/weather.js';
import { formatWeather } from '../src/output.js';

const geoBody = {
  navn: [{
    navneobjekttype: 'Fylke',
    geojson: { geometry: { type: 'Point', coordinates: [10.73353, 59.91187] } },
  }],
};

const wxBody = {
  properties: {
    timeseries: [{
      time: '2026-09-03T06:00:00Z',
      data: {
        instant: {
          details: {
            air_temperature: 12.6,
            relative_humidity: 64.7,
            cloud_area_fraction: 12.7,
            wind_speed: 0.7,
            air_pressure_at_sea_level: 1007.1,
            ultraviolet_index_clear_sky: 0.3,
          },
        },
      },
    }],
  },
};

function pipeline() {
  const calls = [];
  const http = async (url, config) => {
    calls.push({ url, config });
    if (url.includes('geonorge.no')) return { data: geoBody, url, config };
    return { data: wxBody, url, config };
  };
  return { calls, http };
}

test('name input flows through geocode to weather to output', async () => {
  const { calls, http } = pipeline();
  const loc = parseLocation('Oslo');
  const geo = await geocode(loc.name, { http });
  const wx = await fetchWeather(geo.lat, geo.lon, { http });
  const out = formatWeather({ locationName: geo.name, details: wx.details, hasUv: wx.hasUv, uv: wx.uv });

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^https:\/\/ws\.geonorge\.no\/stedsnavn\/v1\/sted\?sok=Oslo/);
  assert.match(calls[1].url, /api\.met\.no.*lat=59\.91187&lon=10\.73353/);
  assert.equal(out, [
    'Weather in Oslo (Met.no API)',
    'Temperature: 12.6°C',
    'Description: Clear',
    'Humidity: 64.7%',
    'Wind Speed: 0.7 m/s',
    'Pressure: 1007.1 hPa',
    'UV Index: 0.3',
  ].join('\n'));
});

test('coordinate input skips geocoding entirely', async () => {
  const { calls, http } = pipeline();
  const loc = parseLocation('59.91 10.75');
  const wx = await fetchWeather(loc.lat, loc.lon, { http });
  const out = formatWeather({ locationName: loc.label, details: wx.details, hasUv: wx.hasUv, uv: wx.uv });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /api\.met\.no/);
  assert.match(out, /Weather in 59\.91 10\.75 \(Met\.no API\)/);
});

test('a failed geocode rejects the whole pipeline', async () => {
  const http = async (url) => {
    if (url.includes('geonorge.no')) return { data: { navn: [] } };
    throw new Error('weather should not be called');
  };
  const loc = parseLocation('Nowhere');
  await assert.rejects(geocode(loc.name, { http }), /no Norwegian place found/);
});

test('payload without UV still produces complete output', async () => {
  const noUv = JSON.parse(JSON.stringify(wxBody));
  delete noUv.properties.timeseries[0].data.instant.details.ultraviolet_index_clear_sky;
  const http = async () => ({ data: noUv });
  const wx = await fetchWeather(59.91, 10.75, { http });
  const out = formatWeather({ locationName: 'Oslo', details: wx.details, hasUv: wx.hasUv, uv: wx.uv });
  assert.doesNotMatch(out, /UV Index/);
  assert.match(out, /Pressure: 1007\.1 hPa/);
});
