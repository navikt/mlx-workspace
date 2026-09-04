import { describe, it, expect } from "vitest";
import { parseLocation, validateCoords } from "../src/parser.js";

describe("parseLocation", () => {
  it("returns none for empty args", () => {
    expect(parseLocation([])).toEqual({ kind: "none" });
  });

  it("returns name for a single token", () => {
    expect(parseLocation(["Oslo"])).toEqual({ kind: "name", name: "Oslo" });
  });

  it("joins multiple non-numeric tokens into a name", () => {
    expect(parseLocation(["Tromsø", "Nordland"])).toEqual({ kind: "name", name: "Tromsø Nordland" });
  });

  it("returns coords for two numeric tokens in lat lon order", () => {
    expect(parseLocation(["59.91", "10.75"])).toEqual({ kind: "coords", lat: 59.91, lon: 10.75 });
  });

  it("treats non-numeric pairs as names", () => {
    expect(parseLocation(["Oslo", "Bergen"])).toEqual({ kind: "name", name: "Oslo Bergen" });
  });
});

describe("validateCoords", () => {
  it("accepts valid coordinates", () => {
    expect(validateCoords({ lat: 59.91, lon: 10.75 }).ok).toBe(true);
    expect(validateCoords({ lat: -90, lon: -180 }).ok).toBe(true);
    expect(validateCoords({ lat: 90, lon: 180 }).ok).toBe(true);
  });

  it("rejects latitude out of range", () => {
    const r = validateCoords({ lat: 91, lon: 10 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/latitude 91 out of range/);
  });

  it("rejects longitude out of range", () => {
    const r = validateCoords({ lat: 59, lon: 181 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/longitude 181 out of range/);
  });

  it("rejects non-finite values", () => {
    expect(validateCoords({ lat: NaN, lon: 10 }).ok).toBe(false);
    expect(validateCoords({ lat: 59, lon: undefined }).ok).toBe(false);
  });
});
