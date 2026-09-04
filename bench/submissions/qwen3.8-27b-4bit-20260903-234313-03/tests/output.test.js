import { describe, it, expect } from "vitest";
import { describeClouds, formatWeather } from "../src/output.js";

describe("describeClouds", () => {
  it("maps cloud_area_fraction thresholds per spec", () => {
    expect(describeClouds(100)).toBe("Overcast");
    expect(describeClouds(75.1)).toBe("Overcast");
    expect(describeClouds(75)).toBe("Partly cloudy");
    expect(describeClouds(50)).toBe("Mostly clear");
    expect(describeClouds(50.1)).toBe("Partly cloudy");
    expect(describeClouds(25)).toBe("Clear");
    expect(describeClouds(25.1)).toBe("Mostly clear");
    expect(describeClouds(0)).toBe("Clear");
  });

  it("returns Unknown for missing values", () => {
    expect(describeClouds(undefined)).toBe("Unknown");
    expect(describeClouds(NaN)).toBe("Unknown");
  });
});

describe("formatWeather", () => {
  const entry = {
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
  };

  it("renders the spec output format", () => {
    expect(formatWeather("Oslo", { entry, units: {} })).toBe(
      [
        "Weather in Oslo (Met.no API)",
        "Temperature: 14.8°C",
        "Description: Overcast",
        "Humidity: 69.7%",
        "Wind Speed: 2.5 m/s",
        "Pressure: 1003 hPa",
        "UV Index: 0",
      ].join("\n")
    );
  });

  it("uses the location name for coordinate input", () => {
    expect(formatWeather("59.91, 10.75", { entry, units: {} }).split("\n")[0]).toBe(
      "Weather in 59.91, 10.75 (Met.no API)"
    );
  });
});
