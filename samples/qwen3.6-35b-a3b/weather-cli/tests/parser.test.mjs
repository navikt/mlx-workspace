import { describe, it, expect } from "vitest";
import { parseLocation } from "../src/parser.mjs";

describe("parseLocation", () => {
  it("defaults to Oslo when no argument provided", () => {
    const result = parseLocation(["node", "weather.mjs"]);
    expect(result).toEqual({ type: "name", name: "Oslo" });
  });

  it("defaults to Oslo when empty string provided", () => {
    const result = parseLocation(["node", "weather.mjs", ""]);
    expect(result).toEqual({ type: "name", name: "Oslo" });
  });

  it("parses location name", () => {
    const result = parseLocation(["node", "weather.mjs", "Bergen"]);
    expect(result).toEqual({ type: "name", name: "Bergen" });
  });

  it("trims whitespace from location name", () => {
    const result = parseLocation(["node", "weather.mjs", "  Tromsø  "]);
    expect(result).toEqual({ type: "name", name: "Tromsø" });
  });

  it("parses valid coordinates", () => {
    const result = parseLocation(["node", "weather.mjs", "59.91 10.75"]);
    expect(result).toEqual({ type: "coordinates", lat: 59.91, lon: 10.75 });
  });

  it("parses negative coordinates (southern/western hemisphere)", () => {
    const result = parseLocation(["node", "weather.mjs", "-33.87 151.21"]);
    expect(result).toEqual({ type: "coordinates", lat: -33.87, lon: 151.21 });
  });

  it("parses integer coordinates", () => {
    const result = parseLocation(["node", "weather.mjs", "40 73"]);
    expect(result).toEqual({ type: "coordinates", lat: 40, lon: 73 });
  });

  it("throws on invalid latitude (too high)", () => {
    expect(() => parseLocation(["node", "weather.mjs", "91 10"])).toThrow(
      "Invalid latitude: 91"
    );
  });

  it("throws on invalid latitude (too low)", () => {
    expect(() => parseLocation(["node", "weather.mjs", "-91 10"])).toThrow(
      "Invalid latitude: -91"
    );
  });

  it("throws on invalid longitude (too high)", () => {
    expect(() => parseLocation(["node", "weather.mjs", "59 181"])).toThrow(
      "Invalid longitude: 181"
    );
  });

  it("throws on invalid longitude (too low)", () => {
    expect(() => parseLocation(["node", "weather.mjs", "59 -181"])).toThrow(
      "Invalid longitude: -181"
    );
  });

  it("treats single number as location name, not coordinate", () => {
    const result = parseLocation(["node", "weather.mjs", "42"]);
    expect(result).toEqual({ type: "name", name: "42" });
  });

  it("treats three-number sequence as location name", () => {
    const result = parseLocation(["node", "weather.mjs", "59 10 20"]);
    expect(result).toEqual({ type: "name", name: "59 10 20" });
  });
});
