import { describe, it, expect, afterEach } from "vitest";
import { geocode } from "../src/weather.mjs";
import nock from "nock";

// Sample Geonorge response (new format with "navn" array)
const GEONORGE_RESPONSE = {
  metadata: {
    side: 1,
    totaltAntallTreff: 1,
    viserFra: 1,
    viserTil: 1,
  },
  navn: [
    {
      geojson: {
        geometry: {
          type: "Point",
          coordinates: [10.7461, 59.9127], // [lon, lat]
        },
      },
      stedsnavn: [
        {
          navnestatus: "hovednavn",
          skrivemåte: "Oslo",
          språk: "Norsk",
        },
      ],
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
        utkoordsys: "4326",
      })
      .reply(200, GEONORGE_RESPONSE);

    const result = await geocode("Oslo");
    expect(result).toEqual({
      name: "Oslo",
      lat: 59.9127,
      lon: 10.7461,
    });
  });

  it("sends correct query params and headers", async () => {
    let receivedQuery = {};

    nock("https://ws.geonorge.no")
      .get("/stedsnavn/v1/sted")
      .query(true)
      .reply(200, function (_uri) {
        receivedQuery = this.req.headers;
        return GEONORGE_RESPONSE;
      });

    await geocode("Bergen");

    expect(receivedQuery["accept"]).toBe("application/json");
    expect(receivedQuery["user-agent"]).toBe("weather-cli/1.0 github.com/navikt");
  });

  it("throws when no results returned", async () => {
    const emptyResponse = { metadata: {}, navn: [] };

    nock("https://ws.geonorge.no")
      .get("/stedsnavn/v1/sted")
      .query(true)
      .reply(200, emptyResponse);

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
    const responseNoName = {
      metadata: {},
      navn: [
        {
          geojson: {
            geometry: { type: "Point", coordinates: [5.3221, 60.3913] },
          },
          stedsnavn: [], // no skrivemåte
        },
      ],
    };

    nock("https://ws.geonorge.no")
      .get("/stedsnavn/v1/sted")
      .query(true)
      .reply(200, responseNoName);

    const result = await geocode("Bergen");
    expect(result).toEqual({
      name: "Bergen", // fallback to input
      lat: 60.3913,
      lon: 5.3221,
    });
  });
});
