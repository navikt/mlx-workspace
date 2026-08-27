import { describe, it, expect } from "vitest";
import { formatWeather } from "../src/output.mjs";

describe("formatWeather", () => {
  it("formats all fields when provided", () => {
    const result = formatWeather({
      locationName: "Oslo",
      temperature: 5,
      description: "Partly cloudy",
      humidity: 65,
      windSpeed: 3.2,
      pressure: 1013,
      uvIndex: 2,
    });

    expect(result).toBe(
      [
        "Weather in Oslo (Met.no API)",
        "Temperature: 5°C",
        "Description: Partly cloudy",
        "Humidity: 65%",
        "Wind Speed: 3.2 m/s",
        "Pressure: 1013 hPa",
        "UV Index: 2",
      ].join("\n")
    );
  });

  it("replaces null values with N/A", () => {
    const result = formatWeather({
      locationName: "Bergen",
      temperature: null,
      description: null,
      humidity: null,
      windSpeed: null,
      pressure: null,
      uvIndex: null,
    });

    expect(result).toBe(
      [
        "Weather in Bergen (Met.no API)",
        "Temperature: N/A°C",
        "Description: N/A",
        "Humidity: N/A%",
        "Wind Speed: N/A m/s",
        "Pressure: N/A hPa",
        "UV Index: N/A",
      ].join("\n")
    );
  });

  it("handles zero values correctly (not null)", () => {
    const result = formatWeather({
      locationName: "Tromsø",
      temperature: 0,
      description: "Clear",
      humidity: 0,
      windSpeed: 0,
      pressure: 1000,
      uvIndex: 0,
    });

    expect(result).toContain("Temperature: 0°C");
    expect(result).toContain("Humidity: 0%");
    expect(result).toContain("Wind Speed: 0 m/s");
    expect(result).toContain("UV Index: 0");
    expect(result).not.toContain("N/A");
  });

  it("handles decimal temperatures", () => {
    const result = formatWeather({
      locationName: "Stavanger",
      temperature: -2.5,
      description: "Light snow",
      humidity: 82,
      windSpeed: 5.7,
      pressure: 998.3,
      uvIndex: 0.2,
    });

    expect(result).toContain("Temperature: -2.5°C");
    expect(result).toContain("Pressure: 998.3 hPa");
    expect(result).toContain("UV Index: 0.2");
  });
});
