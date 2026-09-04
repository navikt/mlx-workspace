import { describe, it, expect } from "vitest";
import { run } from "../src/index.js";

function captureStream() {
  let out = "";
  let err = "";
  return {
    stdout: { write: (s) => (out += s) },
    stderr: { write: (s) => (err += s) },
    get out() {
      return out;
    },
    get err() {
      return err;
    },
  };
}

const OSLO_BODY = {
  metadata: { totaltAntallTreff: 125 },
  navn: [
    {
      geojson: { geometry: { coordinates: [10.73353, 59.91187], type: "Point" } },
      stedsnavn: [{ skrivemåte: "Oslo" }],
    },
  ],
};

const MET_BODY = {
  type: "Feature",
  properties: {
    meta: {
      updated_at: "2026-09-03T21:30:27Z",
      units: { air_temperature: "celsius" },
    },
    timeseries: [
      {
        time: "2026-09-03T22:00:00Z",
        data: {
          instant: {
            details: {
              air_temperature: 14.8,
              relative_humidity: 69.7,
              wind_speed: 2.5,
              air_pressure_at_sea_level: 1003,
              cloud_area_fraction: 100,
              ultraviolet_index_clear_sky: 0,
            },
          },
        },
      },
    ],
  },
};

function fakeGeonorge(name) {
  return {
    get: async (url) => {
      const sok = new URL(url).searchParams.get("sok");
      if (sok !== name) {
        return { status: 200, data: { metadata: { totaltAntallTreff: 0 }, navn: [] } };
      }
      return { status: 200, data: OSLO_BODY };
    },
  };
}

function fakeMetno() {
  return { get: async () => ({ status: 200, data: MET_BODY }) };
}

describe("run (integration, mocked HTTP)", () => {
  it("resolves a place name end to end", async () => {
    const streams = captureStream();
    const code = await run(["Oslo"], {
      geocode: (n, o) => import("../src/geocode.js").then((m) => m.geocode(n, { ...o, http: fakeGeonorge("Oslo") })),
      fetchWeather: (p, o) => import("../src/weather.js").then((m) => m.fetchWeather(p, { ...o, http: fakeMetno() })),
      ...streams,
    });
    expect(code).toBe(0);
    expect(streams.out).toBe(
      [
        "Weather in Oslo (Met.no API)",
        "Temperature: 14.8°C",
        "Description: Overcast",
        "Humidity: 69.7%",
        "Wind Speed: 2.5 m/s",
        "Pressure: 1003 hPa",
        "UV Index: 0",
        "",
      ].join("\n")
    );
  });

  it("accepts coordinate input without geocoding", async () => {
    const streams = captureStream();
    let geocoded = false;
    const code = await run(["59.91", "10.75"], {
      geocode: async () => {
        geocoded = true;
        return { name: "X", lat: 0, lon: 0 };
      },
      fetchWeather: (p, o) => import("../src/weather.js").then((m) => m.fetchWeather(p, { ...o, http: fakeMetno() })),
      ...streams,
    });
    expect(code).toBe(0);
    expect(geocoded).toBe(false);
    expect(streams.out).toContain("Weather in 59.91, 10.75 (Met.no API)");
  });

  it("exits 1 with usage when no args", async () => {
    const streams = captureStream();
    const code = await run([], { ...streams });
    expect(code).toBe(1);
    expect(streams.err).toContain("Usage:");
  });

  it("exits 1 on invalid coordinates", async () => {
    const streams = captureStream();
    const code = await run(["999", "10"], { ...streams });
    expect(code).toBe(1);
    expect(streams.err).toMatch(/latitude 999 out of range/);
  });

  it("exits 1 when geocoding finds no place", async () => {
    const streams = captureStream();
    const code = await run(["Paris"], {
      geocode: (n, o) => import("../src/geocode.js").then((m) => m.geocode(n, { ...o, http: fakeGeonorge("Oslo") })),
      fetchWeather: async () => {
        throw new Error("should not be called");
      },
      ...streams,
    });
    expect(code).toBe(1);
    expect(streams.err).toContain('no place found for "Paris"');
  });

  it("exits 1 when the weather API fails", async () => {
    const streams = captureStream();
    const fail = Object.assign(new Error("Request failed with status code 403"), { response: { status: 403 } });
    const code = await run(["Oslo"], {
      geocode: (n, o) => import("../src/geocode.js").then((m) => m.geocode(n, { ...o, http: fakeGeonorge("Oslo") })),
      fetchWeather: (p, o) => import("../src/weather.js").then((m) => m.fetchWeather(p, { ...o, http: { get: async () => { throw fail; } } })),
      ...streams,
    });
    expect(code).toBe(1);
    expect(streams.err).toContain("HTTP 403");
  });
});
