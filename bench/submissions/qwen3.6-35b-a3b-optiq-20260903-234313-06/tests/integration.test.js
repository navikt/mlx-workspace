import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';

describe('Integration', () => {
  it('should handle full flow: parse name -> geocode -> fetch weather -> format output', async () => {
    const now = new Date();

    // Mock geocode response
    const geocodeResponse = {
      data: {
        navn: [
          {
            geojson: {
              geometry: {
                coordinates: [10.73353, 59.91187],
              },
            },
            stedsnavn: [
              {
                skrivemåte: 'Oslo',
              },
            ],
          },
        ],
      },
    };

    // Mock weather response
    const weatherResponse = {
      data: {
        properties: {
          timeseries: [
            {
              time: now.toISOString(),
              data: {
                instant: {
                  details: {
                    air_temperature: 12.5,
                    relative_humidity: 65.3,
                    wind_speed: 2.1,
                    air_pressure_at_sea_level: 1005.2,
                    ultraviolet_index_clear_sky: 3.2,
                    cloud_area_fraction: 40,
                  },
                },
              },
            },
          ],
        },
      },
    };

    let callOrder = [];

    mock.method(axios, 'get', (url) => {
      if (url.includes('geonorge')) {
        callOrder.push('geocode');
        return Promise.resolve(geocodeResponse);
      }
      callOrder.push('weather');
      return Promise.resolve(weatherResponse);
    });

    // Import and run main
    const { parseLocation } = await import('../src/parser.js');
    const { geocode } = await import('../src/geocode.js');
    const { fetchWeather } = await import('../src/weather.js');
    const { formatWeather } = await import('../src/output.js');

    const location = parseLocation('Oslo');
    assert.strictEqual(location.type, 'name');

    const geoResult = await geocode(location.name);
    assert.strictEqual(geoResult.lat, 59.91187);
    assert.strictEqual(geoResult.lon, 10.73353);

    const weather = await fetchWeather(geoResult.lat, geoResult.lon);
    assert.strictEqual(weather.temperature, 12.5);
    assert.strictEqual(weather.description, 'Mostly clear');

    const output = formatWeather(geoResult.name, weather);
    assert.ok(output.includes('Weather in Oslo'));
    assert.ok(output.includes('Temperature: 12.5'));
    assert.ok(output.includes('Description: Mostly clear'));
    assert.ok(output.includes('Humidity: 65.3'));
    assert.ok(output.includes('Wind Speed: 2.1'));
    assert.ok(output.includes('Pressure: 1005.2'));
    assert.ok(output.includes('UV Index: 3.2'));

    assert.deepStrictEqual(callOrder, ['geocode', 'weather']);
  });

  it('should handle full flow with coordinates (skip geocode)', async () => {
    const now = new Date();

    const weatherResponse = {
      data: {
        properties: {
          timeseries: [
            {
              time: now.toISOString(),
              data: {
                instant: {
                  details: {
                    air_temperature: 8.0,
                    relative_humidity: 80.0,
                    wind_speed: 4.5,
                    air_pressure_at_sea_level: 998.0,
                    ultraviolet_index_clear_sky: 0.5,
                    cloud_area_fraction: 100,
                  },
                },
              },
            },
          ],
        },
      },
    };

    mock.method(axios, 'get', () => Promise.resolve(weatherResponse));

    const { parseLocation } = await import('../src/parser.js');
    const { fetchWeather } = await import('../src/weather.js');
    const { formatWeather } = await import('../src/output.js');

    const location = parseLocation('59.91 10.75');
    assert.strictEqual(location.type, 'coords');

    const weather = await fetchWeather(location.lat, location.lon);
    assert.strictEqual(weather.description, 'Overcast');

    const output = formatWeather(`${location.lat} ${location.lon}`, weather);
    assert.ok(output.includes('Weather in 59.91 10.75'));
    assert.ok(output.includes('Temperature: 8.0'));
    assert.ok(output.includes('Description: Overcast'));
  });

  it('should exit with error on geocode failure', async () => {
    mock.method(axios, 'get', () =>
      Promise.resolve({ data: { navn: [] } })
    );

    const { parseLocation } = await import('../src/parser.js');
    const { geocode } = await import('../src/geocode.js');

    const location = parseLocation('nonexistentplace123');

    await assert.rejects(
      geocode(location.name),
      /No location found/
    );
  });

  it('should exit with error on missing parser argument', async () => {
    const { parseLocation } = await import('../src/parser.js');

    try {
      parseLocation('');
      assert.fail('Expected parseLocation to throw');
    } catch (error) {
      assert.ok(/Location argument is required/.test(error.message));
    }
  });
});
