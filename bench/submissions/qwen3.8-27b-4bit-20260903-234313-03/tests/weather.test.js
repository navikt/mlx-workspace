import { describe, it, expect } from "vitest";
import { fetchWeather, findClosestEntry, buildWeatherUrl } from "../src/weather.js";

function entry(time, details = {}) {
  return {
    time,
    data: {
      instant: {
        details: {
          air_temperature: 10,
          relative_humidity: 50,
          wind_speed: 3,
          air_pressure_at_sea_level: 1013,
          cloud_area_fraction: 0,
          ultraviolet_index_clear_sky: 1,
          ...details,
        },
      },
    },
  };
}

function body(entries) {
  return {
    type: "Feature",
    properties: {
      meta: {
        updated_at: "2026-09-03T21:30:27Z",
        units: { air_temperature: "celsius", cloud_area_fraction: "%" },
      },
      timeseries: entries,
    },
  };
}

function fakeHttp(data, { fail = null } = {}) {
  return {
    get: async (url, config) => {
      if (fail) throw fail;
      return { status: 200, data, config };
    },
  };
}

describe("buildWeatherUrl", () => {
  it("sets lat and lon query params", () => {
    const url = new URL(buildWeatherUrl(59.91, 10.75, "https://api.met.no/weatherapi/locationforecast/2.0/complete"));
    expect(url.searchParams.get("lat")).toBe("59.91");
    expect(url.searchParams.get("lon")).toBe("10.75");
  });
});

describe("findClosestEntry", () => {
  const entries = [entry("2026-09-03T21:00:00Z"), entry("2026-09-03T22:00:00Z"), entry("2026-09-03T23:00:00Z")];
  const now = new Date("2026-09-03T22:10:00Z");

  it("picks the entry closest to now", () => {
    expect(findClosestEntry(entries, now).time).toBe("2026-09-03T22:00:00Z");
  });

  it("picks the earlier entry on a tie", () => {
    const tie = [entry("2026-09-03T21:30:00Z"), entry("2026-09-03T22:30:00Z")];
    expect(findClosestEntry(tie, new Date("2026-09-03T22:00:00Z")).time).toBe("2026-09-03T21:30:00Z");
  });

  it("throws on empty timeseries", () => {
    expect(() => findClosestEntry([])).toThrow(/empty timeseries/);
    expect(() => findClosestEntry(undefined)).toThrow(/empty timeseries/);
  });
});

describe("fetchWeather", () => {
  it("returns the closest entry, units and updated_at", async () => {
    const data = body([entry("2026-09-03T21:00:00Z", { air_temperature: 14.1 }), entry("2026-09-03T22:00:00Z", { air_temperature: 14.8 })]);
    const r = await fetchWeather({ lat: 59.91, lon: 10.75 }, {
      http: fakeHttp(data),
      base: "https://api.met.no/weatherapi/locationforecast/2.0/complete",
    });
    expect(r.entry.time).toBe("2026-09-03T22:00:00Z");
    expect(r.entry.data.instant.details.air_temperature).toBe(14.8);
    expect(r.units.air_temperature).toBe("celsius");
    expect(r.updatedAt).toBe("2026-09-03T21:30:27Z");
  });

  it("throws a helpful error on 403", async () => {
    const fail = Object.assign(new Error("Request failed with status code 403"), { response: { status: 403 } });
    await expect(fetchWeather({ lat: 0, lon: 0 }, { http: fakeHttp(null, { fail }) })).rejects.toThrow(
      /HTTP 403.*User-Agent/s
    );
  });

  it("throws a helpful error on 429", async () => {
    const fail = Object.assign(new Error("Request failed with status code 429"), { response: { status: 429 } });
    await expect(fetchWeather({ lat: 0, lon: 0 }, { http: fakeHttp(null, { fail }) })).rejects.toThrow(
      /HTTP 429/
    );
  });

  it("throws a generic error on other HTTP failures", async () => {
    const fail = Object.assign(new Error("Request failed with status code 502"), { response: { status: 502 } });
    await expect(fetchWeather({ lat: 0, lon: 0 }, { http: fakeHttp(null, { fail }) })).rejects.toThrow(
      /HTTP 502/
    );
  });

  it("sends the provided User-Agent header", async () => {
    let seen;
    const http = {
      get: async (url, config) => {
        seen = config.headers;
        return { status: 200, data: body([entry("2026-09-03T22:00:00Z")]) };
      },
    };
    await fetchWeather({ lat: 0, lon: 0 }, { http, headers: { "User-Agent": "weather-cli/1.0 contact" } });
    expect(seen["User-Agent"]).toBe("weather-cli/1.0 contact");
  });
});
