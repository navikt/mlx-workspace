import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

describe('integration', () => {
  it('full flow: geocode Oslo + fetch weather + format output', async () => {
    const geocodeResponse = {
      navn: [
        {
          geojson: {
            geometry: {
              coordinates: [10.73353, 59.91187],
              type: 'Point',
            },
          },
          stedsnavn: [{ skrivemåte: 'Oslo' }],
          navneobjekttype: 'Fylke',
        },
      ],
    };

    const weatherResponse = {
      properties: {
        meta: {
          updated_at: '2026-09-03T07:31:58Z',
          units: { air_temperature: 'celsius' },
        },
        timeseries: [
          {
            time: new Date(Date.now() - 1800000).toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 14,
                  relative_humidity: 54.9,
                  wind_speed: 2.2,
                  air_pressure_at_sea_level: 1006.9,
                  ultraviolet_index_clear_sky: 1.5,
                  cloud_area_fraction: 13.6,
                },
              },
            },
          },
        ],
      },
    };

    let capturedCalls = [];

    mock.method(axios, 'get', (url) => {
      capturedCalls.push(url);
      if (url.includes('geonorge')) {
        return Promise.resolve({ data: geocodeResponse });
      }
      return Promise.resolve({ data: weatherResponse });
    });

    const { parseLocation } = await import('../parser.js');
    const { geocode } = await import('../geocode.js');
    const { fetchWeather, findClosestEntry, extractData } = await import('../weather.js');
    const { formatOutput } = await import('../output.js');

    const location = parseLocation('Oslo');
    assert.strictEqual(location.type, 'name');

    const geo = await geocode(location.name);
    assert.strictEqual(geo.lat, 59.91187);
    assert.strictEqual(geo.lon, 10.73353);
    assert.strictEqual(geo.displayName, 'Oslo');

    const weatherData = await fetchWeather(geo.lat, geo.lon);
    assert.ok(weatherData.properties.timeseries.length > 0);

    const closestEntry = findClosestEntry(weatherData.properties.timeseries);
    const data = extractData(closestEntry);

    assert.strictEqual(data.temperature, 14);
    assert.strictEqual(data.description, 'Clear');
    assert.strictEqual(data.humidity, 54.9);
    assert.strictEqual(data.windSpeed, 2.2);
    assert.strictEqual(data.pressure, 1006.9);
    assert.strictEqual(data.uvIndex, 1.5);

    const output = formatOutput(geo.displayName, data);
    const lines = output.split('\n');
    assert.strictEqual(lines[0], 'Weather in Oslo (Met.no API)');
    assert.strictEqual(lines[1], 'Temperature: 14°C');
    assert.strictEqual(lines[2], 'Description: Clear');
    assert.strictEqual(lines[3], 'Humidity: 54.9%');
    assert.strictEqual(lines[4], 'Wind Speed: 2.2 m/s');
    assert.strictEqual(lines[5], 'Pressure: 1006.9 hPa');
    assert.strictEqual(lines[6], 'UV Index: 1.5');
  });

  it('full flow: coordinates input (skip geocode)', async () => {
    const weatherResponse = {
      properties: {
        timeseries: [
          {
            time: new Date(Date.now() - 1800000).toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 10,
                  relative_humidity: 70,
                  wind_speed: 3,
                  air_pressure_at_sea_level: 1000,
                  ultraviolet_index_clear_sky: 0.5,
                  cloud_area_fraction: 80,
                },
              },
            },
          },
        ],
      },
    };

    mock.method(axios, 'get', () => Promise.resolve({ data: weatherResponse }));

    const { parseLocation } = await import('../parser.js');
    const { fetchWeather, findClosestEntry, extractData } = await import('../weather.js');
    const { formatOutput } = await import('../output.js');

    const location = parseLocation('59.91 10.75');
    assert.strictEqual(location.type, 'coordinates');

    const weatherData = await fetchWeather(location.lat, location.lon);
    const closestEntry = findClosestEntry(weatherData.properties.timeseries);
    const data = extractData(closestEntry);

    assert.strictEqual(data.description, 'Overcast');

    const output = formatOutput(`(${location.lat}, ${location.lon})`, data);
    assert.ok(output.includes('Weather in (59.91, 10.75)'));
    assert.ok(output.includes('Temperature: 10°C'));
    assert.ok(output.includes('Description: Overcast'));
  });

  it('error flow: geocode failure exits with error', async () => {
    mock.method(axios, 'get', () =>
      Promise.resolve({ data: { navn: [] } })
    );

    const { parseLocation } = await import('../parser.js');
    const { geocode } = await import('../geocode.js');

    try {
      await geocode('NonExistentPlaceXYZ123');
      assert.fail('Should have thrown');
    } catch (error) {
      assert.ok(error.message.includes('No location found'));
    }
  });

  it('error flow: missing UV and cloud data handled gracefully', async () => {
    const weatherResponse = {
      properties: {
        timeseries: [
          {
            time: new Date(Date.now() - 1800000).toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 12,
                  relative_humidity: 65,
                  wind_speed: 4,
                  air_pressure_at_sea_level: 1005,
                  // No ultraviolet_index_clear_sky
                  // No cloud_area_fraction
                },
              },
            },
          },
        ],
      },
    };

    mock.method(axios, 'get', () => Promise.resolve({ data: weatherResponse }));

    const { fetchWeather, findClosestEntry, extractData } = await import('../weather.js');
    const { formatOutput } = await import('../output.js');

    const weatherData = await fetchWeather(59.91, 10.75);
    const closestEntry = findClosestEntry(weatherData.properties.timeseries);
    const data = extractData(closestEntry);

    assert.strictEqual(data.uvIndex, undefined);
    assert.strictEqual(data.description, undefined);

    const output = formatOutput('Test Location', data);
    const lines = output.split('\n');

    // Should have 5 lines (no Description, no UV Index)
    assert.strictEqual(lines.length, 5);
    assert.ok(!lines.some(l => l.startsWith('Description:')));
    assert.ok(!lines.some(l => l.startsWith('UV Index:')));
  });

  it('UTC drift: findClosestEntry uses UTC timestamps for comparison', async () => {
    // The timeseries entries use ISO 8601 UTC strings.
    // findClosestEntry converts them via new Date(time).getTime() which always
    // interprets the ISO string as UTC, regardless of the host's local timezone.
    // This test verifies the logic by creating a known timeseries and checking
    // that the closest entry is selected correctly.
    const now = new Date();
    const timeseries = [
      { time: new Date(now.getTime() - 7200000).toISOString() }, // 2h before
      { time: new Date(now.getTime() - 3600000).toISOString() }, // 1h before
      { time: new Date(now.getTime() + 300000).toISOString() },  // 5min after
      { time: new Date(now.getTime() + 3600000).toISOString() }, // 1h after
    ];

    const { findClosestEntry } = await import('../weather.js');
    const closest = findClosestEntry(timeseries);

    // 5min after should be closest (300s vs 3600s)
    const expectedTime = new Date(now.getTime() + 300000).toISOString();
    assert.strictEqual(closest.time, expectedTime);
  });
});
