import { describe, it, expect, afterEach } from "vitest";
import { parseLocation } from "../src/parser.mjs";
import { geocode, fetchWeather } from "../src/weather.mjs";
import { formatWeather } from "../src/output.mjs";
import nock from "nock";

// Sample Geonorge GeoJSON response
const GEONORGE_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [10.7461, 59.9127], // [lon, lat]
      },
      properties: {
        navn: "Oslo",
        type: "By",
      },
    },
  ],
};

// Sample Met.no timeseries response
const METNO_TIMESERIES = {
  product: {
    timeseries: [
      {
        time: new Date(Date.now() + 3600000).toISOString(), // +1 hour
        data: {
          instant: {
            details: {
              air_temperature: 2.5,
              cloud_area_fraction: 80, // > 75 → Overcast
              relative_humidity: 78,
              wind_speed: 3.1,
              air_pressure_at_sea_level: 1013.2,
              uv_index_clear_sky: 0.5,
            },
          },
        },
      },
    ],
  },
};

describe("integration", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("full pipeline: name → geocode → weather → format", async () => {
    nock("https://ws.geonorge.no")
      .get("/stedsnavn/v1/sted")
      .query({
        sok: "Oslo",
        fuzzy: "true",
        treffPerSide: "1",
        utkoordsys: "4258",
      })
      .reply(200, GEONORGE_GEOJSON);

    nock("https://api.met.no")
      .get("/weatherapi/locationforecast/2.0/complete")
      .query(true)
      .reply(200, METNO_TIMESERIES);

    // Step 1: Parse location
    const location = parseLocation(["node", "weather.mjs", "Oslo"]);
    expect(location.type).toBe("name");

    // Step 2: Geocode
    const geo = await geocode(location.name);
    expect(geo).toEqual({ name: "Oslo", lat: 59.9127, lon: 10.7461 });

    // Step 3: Fetch weather
    const weather = await fetchWeather(geo.lat, geo.lon);
    expect(weather.temperature).toBe(2.5);
    expect(weather.description).toBe("Overcast"); // 80% > 75%

    // Step 4: Format output
    const output = formatWeather({ locationName: geo.name, ...weather });

    expect(output).toContain("Weather in Oslo (Met.no API)");
    expect(output).toContain("Temperature: 2.5°C");
    expect(output).toContain("Description: Overcast");
    expect(output).toContain("Humidity: 78%");
    expect(output).toContain("Wind Speed: 3.1 m/s");
    expect(output).toContain("Pressure: 1013.2 hPa");
    expect(output).toContain("UV Index: 0.5");
  });

  it("full pipeline: coordinates → weather → format (skip geocode)", async () => {
    nock("https://api.met.no")
      .get("/weatherapi/locationforecast/2.0/complete")
      .query(true)
      .reply(200, METNO_TIMESERIES);

    // Step 1: Parse coordinates
    const location = parseLocation(["node", "weather.mjs", "59.91 10.75"]);
    expect(location.type).toBe("coordinates");

    // Step 2: Fetch weather directly (skip geocode)
    const weather = await fetchWeather(location.lat, location.lon);

    // Step 3: Format output with coordinate-based name
    const output = formatWeather({
      locationName: `${location.lat}°N, ${location.lon}°E`,
      ...weather,
    });

    expect(output).toContain("Weather in 59.91°N, 10.75°E (Met.no API)");
    expect(output).toContain("Temperature: 2.5°C");
    expect(output).toContain("Description: Overcast");
  });

  it("handles API failure with descriptive error", async () => {
    nock("https://ws.geonorge.no")
      .get("/stedsnavn/v1/sted")
      .query(true)
      .reply(404, "Not Found");

    const location = parseLocation(["node", "weather.mjs", "NonExistentCity"]);

    await expect(geocode(location.name)).rejects.toThrow(
      "Geocoding failed: 404"
    );
  });

  it("handles partial weather data (some fields missing)", async () => {
    const partialResponse = {
      product: {
        timeseries: [
          {
            time: new Date(Date.now() + 3600000).toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 1.0,
                  // only temperature provided
                },
              },
            },
          },
        ],
      },
    };

    nock("https://ws.geonorge.no")
      .get("/stedsnavn/v1/sted")
      .query(true)
      .reply(200, GEONORGE_GEOJSON);

    nock("https://api.met.no")
      .get("/weatherapi/locationforecast/2.0/complete")
      .query(true)
      .reply(200, partialResponse);

    const location = parseLocation(["node", "weather.mjs", "Oslo"]);
    const geo = await geocode(location.name);
    const weather = await fetchWeather(geo.lat, geo.lon);

    expect(weather.temperature).toBe(1.0);
    expect(weather.humidity).toBeNull();
    expect(weather.windSpeed).toBeNull();

    const output = formatWeather({ locationName: geo.name, ...weather });
    expect(output).toContain("N/A");
  });

  it("description thresholds work end-to-end", async () => {
    const testCases = [
      { cloud: 10, expected: "Clear" },
      { cloud: 26, expected: "Mostly clear" },
      { cloud: 51, expected: "Partly cloudy" },
      { cloud: 76, expected: "Overcast" },
    ];

    for (const tc of testCases) {
      const response = {
        product: {
          timeseries: [
            {
              time: new Date(Date.now() + 3600000).toISOString(),
              data: {
                instant: {
                  details: {
                    air_temperature: 5,
                    cloud_area_fraction: tc.cloud,
                    relative_humidity: 60,
                    wind_speed: 2,
                    air_pressure_at_sea_level: 1010,
                    uv_index_clear_sky: 1,
                  },
                },
              },
            },
          ],
        },
      };

      nock("https://ws.geonorge.no")
        .get("/stedsnavn/v1/sted")
        .query(true)
        .reply(200, GEONORGE_GEOJSON);

      nock("https://api.met.no")
        .get("/weatherapi/locationforecast/2.0/complete")
        .query(true)
        .reply(200, response);

      const location = parseLocation(["node", "weather.mjs", "Oslo"]);
      const geo = await geocode(location.name);
      const weather = await fetchWeather(geo.lat, geo.lon);

      expect(weather.description).toBe(tc.expected);

      // Clean up for next iteration
      nock.cleanAll();
    }
  });
});
