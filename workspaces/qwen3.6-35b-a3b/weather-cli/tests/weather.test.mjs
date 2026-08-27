import { describe, it, expect, afterEach } from "vitest";
import { fetchWeather } from "../src/weather.mjs";
import nock from "nock";

// Sample Met.no response (new format with "properties" at top level)
const METNO_TIMESERIES = {
  type: "Feature",
  geometry: {
    type: "Point",
    coordinates: [10.75, 59.91, 1],
  },
  properties: {
    meta: {
      updated_at: "2024-01-01T00:00:00Z",
      units: {
        air_temperature: "celsius",
      },
    },
    timeseries: [
      {
        time: "2024-01-01T00:00:00Z",
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
      {
        time: "2024-01-01T06:00:00Z",
        data: {
          instant: {
            details: {
              air_temperature: 1.0,
              cloud_area_fraction: 40, // > 25, <= 50 → Mostly clear
              relative_humidity: 85,
              wind_speed: 2.0,
              air_pressure_at_sea_level: 1015.0,
              uv_index_clear_sky: 0.2,
            },
          },
        },
      },
      {
        time: "2024-01-01T12:00:00Z",
        data: {
          instant: {
            details: {
              air_temperature: 4.0,
              cloud_area_fraction: 20, // <= 25 → Clear
              relative_humidity: 60,
              wind_speed: 4.5,
              air_pressure_at_sea_level: 1010.0,
              uv_index_clear_sky: 1.0,
            },
          },
        },
      },
    ],
  },
};

// Response with missing fields
const METNO_PARTIAL = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [0, 0, 1] },
  properties: {
    timeseries: [
      {
        time: "2024-01-01T00:00:00Z",
        data: {
          instant: {
            details: {
              air_temperature: 0,
              // no cloud_area_fraction, no humidity, etc.
            },
          },
        },
      },
    ],
  },
};

// Response with missing instant details
const METNO_NO_DETAILS = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [0, 0, 1] },
  properties: {
    timeseries: [
      {
        time: "2024-01-01T00:00:00Z",
        data: {}, // no instant at all
      },
    ],
  },
};

// Empty timeseries
const METNO_EMPTY = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [0, 0, 1] },
  properties: {
    timeseries: [],
  },
};

describe("fetchWeather", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("returns structured weather data from timeseries", async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const futureResponse = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [59.91, 10.75, 1] },
      properties: {
        timeseries: [
          {
            time: futureDate,
            data: {
              instant: {
                details: {
                  air_temperature: 2.5,
                  cloud_area_fraction: 80,
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

    nock("https://api.met.no")
      .get("/weatherapi/locationforecast/2.0/complete")
      .query(true)
      .reply(200, futureResponse);

    const result = await fetchWeather(59.91, 10.75);

    expect(result).toEqual({
      temperature: 2.5,
      description: "Overcast", // 80% > 75%
      humidity: 78,
      windSpeed: 3.1,
      pressure: 1013.2,
      uvIndex: 0.5,
    });
  });

  it("selects the timeseries entry closest to current time", async () => {
    const futureDate = new Date(Date.now() + 3600000); // +1 hour
    const nearFutureDate = new Date(Date.now() + 1800000); // +30 min

    const response = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0, 1] },
      properties: {
        timeseries: [
          {
            time: futureDate.toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 10,
                  cloud_area_fraction: 10, // Clear
                  relative_humidity: 50,
                  wind_speed: 1,
                  air_pressure_at_sea_level: 1000,
                  uv_index_clear_sky: 5,
                },
              },
            },
          },
          {
            time: nearFutureDate.toISOString(),
            data: {
              instant: {
                details: {
                  air_temperature: 5,
                  cloud_area_fraction: 60, // Partly cloudy
                  relative_humidity: 70,
                  wind_speed: 3,
                  air_pressure_at_sea_level: 1010,
                  uv_index_clear_sky: 2,
                },
              },
            },
          },
        ],
      },
    };

    nock("https://api.met.no")
      .get("/weatherapi/locationforecast/2.0/complete")
      .query(true)
      .reply(200, response);

    const result = await fetchWeather(0, 0);

    // Should pick the closer entry (nearFutureDate, +30min vs +1hr)
    expect(result.temperature).toBe(5);
    expect(result.description).toBe("Partly cloudy"); // 60% > 50%
  });

  it("derives description from cloud coverage thresholds", async () => {
    const testCases = [
      { cloud: 10, expected: "Clear" },
      { cloud: 25, expected: "Clear" }, // not > 25
      { cloud: 26, expected: "Mostly clear" }, // > 25
      { cloud: 50, expected: "Mostly clear" }, // not > 50
      { cloud: 51, expected: "Partly cloudy" }, // > 50
      { cloud: 75, expected: "Partly cloudy" }, // not > 75
      { cloud: 76, expected: "Overcast" }, // > 75
      { cloud: 100, expected: "Overcast" },
    ];

    for (const tc of testCases) {
      const response = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0, 1] },
        properties: {
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

      nock("https://api.met.no")
        .get("/weatherapi/locationforecast/2.0/complete")
        .query(true)
        .reply(200, response);

      const result = await fetchWeather(0, 0);
      expect(result.description).toBe(tc.expected);
    }
  });

  it("handles missing fields gracefully (null)", async () => {
    nock("https://api.met.no")
      .get("/weatherapi/locationforecast/2.0/complete")
      .query(true)
      .reply(200, METNO_PARTIAL);

    const result = await fetchWeather(0, 0);

    expect(result.temperature).toBe(0);
    expect(result.description).toBe("N/A"); // no cloud_area_fraction
    expect(result.humidity).toBeNull();
    expect(result.windSpeed).toBeNull();
    expect(result.pressure).toBeNull();
    expect(result.uvIndex).toBeNull();
  });

  it("throws when timeseries is empty", async () => {
    nock("https://api.met.no")
      .get("/weatherapi/locationforecast/2.0/complete")
      .query(true)
      .reply(200, METNO_EMPTY);

    await expect(fetchWeather(0, 0)).rejects.toThrow(
      "No timeseries data found"
    );
  });

  it("throws when instant details are missing", async () => {
    nock("https://api.met.no")
      .get("/weatherapi/locationforecast/2.0/complete")
      .query(true)
      .reply(200, METNO_NO_DETAILS);

    await expect(fetchWeather(0, 0)).rejects.toThrow(
      "No instant details found"
    );
  });

  it("throws on API error", async () => {
    nock("https://api.met.no")
      .get("/weatherapi/locationforecast/2.0/complete")
      .query(true)
      .reply(503, "Service Unavailable");

    await expect(fetchWeather(0, 0)).rejects.toThrow(
      "Weather API failed: 503"
    );
  });

  it("sends User-Agent header", async () => {
    let receivedHeaders = {};

    nock("https://api.met.no")
      .get("/weatherapi/locationforecast/2.0/complete")
      .query(true)
      .reply(200, function (_uri) {
        receivedHeaders = this.req.headers;
        return METNO_TIMESERIES;
      });

    await fetchWeather(0, 0);

    expect(receivedHeaders["user-agent"]).toBe("weather-cli/1.0 github.com/navikt");
  });
});
