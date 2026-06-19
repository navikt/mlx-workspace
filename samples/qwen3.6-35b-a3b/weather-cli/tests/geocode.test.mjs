import { describe, it, expect, afterEach } from "vitest";
import { geocode } from "../src/weather.mjs";
import nock from "nock";

// Sample Geonorge GeoJSON response
const GEONORGE_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [10.7461, 59.9127], // [lon, lat] — GeoJSON order
      },
      properties: {
        navn: "Oslo",
        type: "By",
        kommunenummer: "0301",
      },
    },
  ],
};

describe("geocode", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("returns lat/lon swapped from GeoJSON [lon, lat] order", async () => {
    nock("https://ws.geonorge.no")
      .get("/stedsnavn/v1/sted")
      .query({
        sok: "Oslo",
        fuzzy: "true",
        treffPerSide: "1",
        utkoordsys: "4258",
      })
      .reply(200, GEONORGE_GEOJSON);

    const result = await geocode("Oslo");
    expect(result).toEqual({
      name: "Oslo",
      lat: 59.9127,
      lon: 10.7461,
    });
  });

  it("sends correct query params and headers", async () => {
    let receivedQuery = {};
    let receivedHeaders = {};

    nock("https://ws.geonorge.no")
      .get("/stedsnavn/v1/sted")
      .query(true)
      .reply(200, function (_uri) {
        receivedQuery = this.req.headers;
        return GEONORGE_GEOJSON;
      });

    await geocode("Bergen");

    expect(receivedQuery["accept"]).toBe("application/json");
    expect(receivedQuery["user-agent"]).toBe("weather-cli/1.0 github.com/navikt");
  });

  it("throws when no features returned", async () => {
    const emptyGeoJSON = { type: "FeatureCollection", features: [] };

    nock("https://ws.geonorge.no")
      .get("/stedsnavn/v1/sted")
      .query(true)
      .reply(200, emptyGeoJSON);

    await expect(geocode("NowhereCity")).rejects.toThrow(
      'No results found for "NowhereCity"'
    );
  });

  it("throws on API error", async () => {
    nock("https://ws.geonorge.no")
      .get("/stedsnavn/v1/sted")
      .query(true)
      .reply(500, "Internal Server Error");

    await expect(geocode("Oslo")).rejects.toThrow(
      "Geocoding failed: 500"
    );
  });

  it("handles missing name property, falls back to input name", async () => {
    const geoJSONNoName = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [5.3221, 60.3913] },
          properties: {}, // no navn
        },
      ],
    };

    nock("https://ws.geonorge.no")
      .get("/stedsnavn/v1/sted")
      .query(true)
      .reply(200, geoJSONNoName);

    const result = await geocode("Bergen");
    expect(result).toEqual({
      name: "Bergen", // fallback to input
      lat: 60.3913,
      lon: 5.3221,
    });
  });
});
